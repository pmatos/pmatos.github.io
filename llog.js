#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const LOCKFILE = path.join(__dirname, '.llog.lock');
const LINKLOG_DATA_FILE = path.join(__dirname, 'src/_11ty/_data/linklog.json');
const CONFIG_FILE = path.join(os.homedir(), 'llog.conf');
const BACKUP_SUFFIX = '.backup';

class LinkLogCLI {
    constructor() {
        this.lockAcquired = false;
        this.backupFiles = [];
        this.gitStashApplied = false;
        this.initialCommitHash = null;
        this.pushCompleted = false;
    }

    async acquireLock() {
        try {
            // Use atomic operation with exclusive flags to prevent race conditions
            const fileHandle = await fs.open(LOCKFILE, 'wx'); // 'w' for write, 'x' for exclusive (fail if exists)
            await fileHandle.writeFile(process.pid.toString());
            await fileHandle.close();
            this.lockAcquired = true;
            console.log('📝 Acquired process lock');
        } catch (error) {
            if (error.code === 'EEXIST') {
                throw new Error('Another llog process is already running');
            } else {
                throw error;
            }
        }
    }

    async releaseLock() {
        if (this.lockAcquired) {
            try {
                await fs.unlink(LOCKFILE);
                console.log('🔓 Released process lock');
            } catch (error) {
                console.warn('⚠️ Warning: Failed to release lock file');
            }
        }
    }

    async loadConfig() {
        try {
            const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
            const config = {};
            
            for (const line of configContent.split('\n')) {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const [key, value] = trimmedLine.split('=', 2);
                    if (key && value) {
                        config[key.trim()] = value.trim();
                    }
                }
            }
            
            return config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw new Error(`Failed to read config file ${CONFIG_FILE}: ${error.message}`);
        }
    }

    async validateApiKey() {
        let apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            const config = await this.loadConfig();
            apiKey = config.CLAUDE_API_KEY || config.ANTHROPIC_API_KEY;
        }
        
        if (!apiKey) {
            throw new Error(`API key not found. Please set one of:\n- Environment variable: CLAUDE_API_KEY or ANTHROPIC_API_KEY\n- Config file: ${CONFIG_FILE} with CLAUDE_API_KEY=your_key or ANTHROPIC_API_KEY=your_key`);
        }
        
        console.log('✅ API key validation passed');
    }

    async createBackup(filePath) {
        const backupPath = filePath + BACKUP_SUFFIX;
        try {
            await fs.copyFile(filePath, backupPath);
            this.backupFiles.push({ original: filePath, backup: backupPath });
            console.log(`💾 Created backup: ${path.basename(backupPath)}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async rollback() {
        console.log('🔄 Rolling back changes...');
        
        // Restore backed up files
        for (const { original, backup } of this.backupFiles) {
            try {
                await fs.copyFile(backup, original);
                await fs.unlink(backup);
                console.log(`↩️ Restored ${path.basename(original)}`);
            } catch (error) {
                console.error(`❌ Failed to restore ${path.basename(original)}: ${error.message}`);
            }
        }

        // Handle git rollback based on whether push was completed
        if (this.gitStashApplied) {
            try {
                if (this.pushCompleted) {
                    // If push was completed, create a revert commit and push it
                    console.log('🔄 Creating revert commit for pushed changes...');
                    const lastCommitHash = execSync('git rev-parse HEAD', { stdio: 'pipe', encoding: 'utf8' }).trim();
                    execSync(`git revert ${lastCommitHash} --no-edit`, { stdio: 'pipe' });
                    execSync('git push origin main', { stdio: 'pipe' });
                    console.log('↩️ Created and pushed revert commit');
                } else {
                    // If push wasn't completed, safe to do hard reset
                    if (this.initialCommitHash) {
                        execSync(`git reset --hard ${this.initialCommitHash}`, { stdio: 'pipe' });
                        console.log('↩️ Reverted git commit');
                    }
                }
            } catch (error) {
                console.error('❌ Failed to revert git changes:', error.message);
            }
        }

        await this.releaseLock();
    }

    async cleanup() {
        // Remove backup files
        for (const { backup } of this.backupFiles) {
            try {
                await fs.unlink(backup);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        await this.releaseLock();
    }

    parseArguments(args) {
        if (!args || args.length === 0) {
            throw new Error('URL is required');
        }

        const rawUrl = args[0];
        const rawTags = args.slice(1).filter(arg => arg.startsWith('#')).map(tag => tag.substring(1));

        // Sanitize and validate URL
        const url = this.sanitizeUrl(rawUrl);
        try {
            new URL(url);
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }

        // Sanitize tags
        const tags = rawTags.map(tag => this.sanitizeTag(tag)).filter(tag => tag.length > 0);

        return { url, tags };
    }

    sanitizeUrl(url) {
        if (typeof url !== 'string') {
            throw new Error('URL must be a string');
        }
        
        // Trim whitespace and remove potentially dangerous characters
        let sanitized = url.trim();
        
        // Ensure URL has protocol
        if (!sanitized.match(/^https?:\/\//i)) {
            sanitized = 'https://' + sanitized;
        }
        
        // Remove any control characters and non-printable characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // Basic length check
        if (sanitized.length > 2048) {
            throw new Error('URL too long (max 2048 characters)');
        }
        
        return sanitized;
    }

    sanitizeTag(tag) {
        if (typeof tag !== 'string') {
            return '';
        }
        
        // Remove whitespace, special characters, and convert to lowercase
        let sanitized = tag.trim().toLowerCase();
        
        // Remove any non-alphanumeric characters except hyphens and underscores
        sanitized = sanitized.replace(/[^a-z0-9_-]/g, '');
        
        // Remove leading/trailing hyphens and underscores
        sanitized = sanitized.replace(/^[-_]+|[-_]+$/g, '');
        
        // Limit length
        if (sanitized.length > 50) {
            sanitized = sanitized.substring(0, 50);
        }
        
        return sanitized;
    }

    async loadLinkLogData() {
        try {
            const data = await fs.readFile(LINKLOG_DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { entries: [] };
            }
            throw error;
        }
    }

    async saveLinkLogData(data) {
        await fs.writeFile(LINKLOG_DATA_FILE, JSON.stringify(data, null, 2));
    }

    generateEntryId() {
        return crypto.randomBytes(8).toString('hex');
    }

    async fetchPageTitle(url, redirectCount = 0) {
        const maxRedirects = 5;
        
        if (redirectCount === 0) {
            console.log(`🔍 Fetching page title from ${url}...`);
        }
        
        if (redirectCount >= maxRedirects) {
            throw new Error(`Too many redirects (${maxRedirects}) for ${url}`);
        }
        
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'identity',
                    'Connection': 'close',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 30000
            };

            const req = client.request(options, (res) => {
                let data = '';
                let titleFound = false;
                
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    let redirectUrl = res.headers.location;
                    
                    // Handle relative redirects by resolving against current URL
                    try {
                        new URL(redirectUrl);
                    } catch (e) {
                        redirectUrl = new URL(redirectUrl, url).href;
                    }
                    
                    return this.fetchPageTitle(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
                }
                
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }

                res.on('data', chunk => {
                    if (titleFound) return;
                    
                    data += chunk;
                    
                    // Try to extract title as soon as we have enough data
                    const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch && !titleFound) {
                        titleFound = true;
                        res.removeAllListeners();
                        res.destroy();
                        
                        let title = titleMatch[1].trim();
                        
                        // Clean up title
                        title = title.replace(/\s+/g, ' ')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#039;/g, "'")
                                    .replace(/&amp;/g, '&');

                        resolve(title);
                        return;
                    }
                    
                    // Stop reading after we have enough data without finding title
                    if (data.length > 100000) {
                        titleFound = true;
                        res.removeAllListeners();
                        res.destroy();
                        resolve(urlObj.hostname);
                    }
                });

                res.on('end', () => {
                    if (!titleFound) {
                        try {
                            // Extract title from HTML
                            const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
                            let title = titleMatch ? titleMatch[1].trim() : urlObj.hostname;
                            
                            // Clean up title
                            title = title.replace(/\s+/g, ' ')
                                        .replace(/&lt;/g, '<')
                                        .replace(/&gt;/g, '>')
                                        .replace(/&quot;/g, '"')
                                        .replace(/&#039;/g, "'")
                                        .replace(/&amp;/g, '&');

                            resolve(title);
                        } catch (error) {
                            resolve(urlObj.hostname);
                        }
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Failed to fetch ${url}: ${error.message}`));
            });

            req.on('timeout', () => {
                req.removeAllListeners();
                req.destroy();
                reject(new Error(`Timeout fetching ${url} after 30 seconds`));
            });

            req.end();
        });
    }

    async callClaudeAPI(prompt) {
        let apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
            const config = await this.loadConfig();
            apiKey = config.CLAUDE_API_KEY || config.ANTHROPIC_API_KEY;
        }
        
        if (!apiKey) {
            throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY not found in environment variables or config file');
        }

        const payload = JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.anthropic.com',
                port: 443,
                path: '/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                timeout: 30000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (res.statusCode !== 200) {
                            return reject(new Error(`Claude API error: ${response.error?.message || data}`));
                        }
                        
                        if (response.content && response.content[0] && response.content[0].text) {
                            resolve(response.content[0].text.trim());
                        } else {
                            reject(new Error('Unexpected Claude API response format'));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse Claude API response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Claude API request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Claude API request timeout'));
            });

            req.write(payload);
            req.end();
        });
    }

    async generateSummary(url, title) {
        console.log('🤖 Generating summary with Claude...');
        
        try {
            const prompt = `Please provide a brief 2-3 sentence summary of this webpage based on its title and URL:
            
Title: ${title}
URL: ${url}

Focus on what the content is likely about and why it might be interesting or useful. Be concise and informative.`;

            const summary = await this.callClaudeAPI(prompt);
            return summary;
        } catch (error) {
            console.warn(`⚠️ Could not generate summary: ${error.message}`);
            return `Interesting link: ${title}`;
        }
    }

    async suggestTags(content, existingTags = []) {
        console.log('🏷️ Suggesting tags...');
        
        try {
            let prompt;
            if (existingTags.length === 0) {
                prompt = `Based on this content, suggest 2-4 relevant tags (single words only, lowercase, no spaces):

${content}

Respond with only the tags separated by commas, like: programming, javascript, tutorial, web`;
            } else {
                prompt = `Based on this content, suggest additional relevant tags if they would add value (single words only, lowercase, no spaces). The user has already provided these tags: ${existingTags.join(', ')}

${content}

Only suggest additional tags if they provide meaningful categorization not covered by existing tags. It's perfectly fine to suggest no additional tags if the existing ones are sufficient. Respond with only the additional tags separated by commas, or respond with just "none" if no additional tags are needed.`;
            }

            const response = await this.callClaudeAPI(prompt);
            
            if (response.toLowerCase().trim() === 'none') {
                return [];
            }
            
            const tags = response.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
            return tags.slice(0, 4); // Max 4 tags
        } catch (error) {
            console.warn(`⚠️ Could not suggest tags: ${error.message}`);
            return [];
        }
    }

    async buildSite() {
        console.log('🔨 Building site...');
        try {
            execSync('npm run go!', { stdio: 'inherit' });
            console.log('✅ Site built successfully');
        } catch (error) {
            throw new Error(`Build failed: ${error.message}`);
        }
    }

    async storeInitialCommitHash() {
        try {
            this.initialCommitHash = execSync('git rev-parse HEAD', { stdio: 'pipe', encoding: 'utf8' }).trim();
            console.log(`📍 Stored initial commit: ${this.initialCommitHash.substring(0, 8)}`);
        } catch (error) {
            console.warn('⚠️ Could not store initial commit hash:', error.message);
        }
    }

    async getGitRemoteUrl() {
        try {
            const remoteUrl = execSync('git remote get-url origin', { stdio: 'pipe', encoding: 'utf8' }).trim();
            
            // Convert various Git URL formats to HTTPS GitHub Pages URL
            // Handle SSH format: git@github.com:user/repo.git
            if (remoteUrl.startsWith('git@github.com:')) {
                const repoPath = remoteUrl.replace('git@github.com:', '').replace('.git', '');
                const [user, repo] = repoPath.split('/');
                return `https://${user}.github.io${repo === `${user}.github.io` ? '' : `/${repo}`}`;
            }
            
            // Handle HTTPS format: https://github.com/user/repo.git
            if (remoteUrl.startsWith('https://github.com/')) {
                const repoPath = remoteUrl.replace('https://github.com/', '').replace('.git', '');
                const [user, repo] = repoPath.split('/');
                return `https://${user}.github.io${repo === `${user}.github.io` ? '' : `/${repo}`}`;
            }
            
            // Fallback for non-GitHub remotes
            console.warn('⚠️ Non-GitHub remote detected, using default URL');
            return 'https://localhost:8080'; // Default for unknown remotes
        } catch (error) {
            console.warn('⚠️ Could not parse git remote URL:', error.message);
            return 'https://localhost:8080'; // Final fallback
        }
    }

    async commitAndPush(url) {
        console.log('📤 Committing and pushing changes...');
        try {
            execSync('git add .', { stdio: 'pipe' });
            execSync(`git commit -m "Add link to linklog: ${url}"`, { stdio: 'pipe' });
            this.gitStashApplied = true;
            execSync('git push origin main', { stdio: 'pipe' });
            this.pushCompleted = true;
            console.log('✅ Changes committed and pushed');
        } catch (error) {
            throw new Error(`Git operations failed: ${error.message}`);
        }
    }

    async verifyDeployment(entryId) {
        console.log('🌐 Verifying online deployment...');
        
        // Get the site URL from meta.js, then git remote, then default
        let siteUrl;
        try {
            const metaFile = await fs.readFile(path.join(__dirname, 'src/_11ty/_data/meta.js'), 'utf8');
            const urlMatch = metaFile.match(/url:\s*(?:process\.env\.URL\s*\|\|\s*)?["']([^"']+)["']/);
            siteUrl = urlMatch ? urlMatch[1] : await this.getGitRemoteUrl();
        } catch (error) {
            siteUrl = await this.getGitRemoteUrl();
        }

        const linklogUrl = `${siteUrl}/linklog.html`;
        
        // Configurable timeout (default 10 minutes)
        const timeoutMinutes = parseInt(process.env.LLOG_DEPLOY_TIMEOUT) || 10;
        const maxDuration = timeoutMinutes * 60 * 1000; // Convert to milliseconds
        const startTime = Date.now();
        
        let attempt = 0;
        let backoffDelay = 5000; // Start with 5 second delay
        const maxBackoffDelay = 60000; // Max 1 minute between attempts
        
        while (Date.now() - startTime < maxDuration) {
            attempt++;
            
            try {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.log(`📡 Checking deployment (attempt ${attempt}, ${elapsed}s elapsed)...`);
                
                const pageContent = await this.fetchPageContent(linklogUrl);
                
                // Check if our entry ID appears in the page
                if (pageContent.includes(entryId)) {
                    const totalTime = Math.round((Date.now() - startTime) / 1000);
                    console.log(`✅ Deployment verified - entry is live! (${totalTime}s)`);
                    return true;
                }
                
            } catch (error) {
                console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
            }
            
            // Check if we have time for another attempt
            if (Date.now() - startTime + backoffDelay >= maxDuration) {
                break;
            }
            
            console.log(`⏳ Entry not yet visible, waiting ${Math.round(backoffDelay/1000)}s...`);
            await this.sleep(backoffDelay);
            
            // Exponential backoff with jitter
            backoffDelay = Math.min(backoffDelay * 1.5 + Math.random() * 1000, maxBackoffDelay);
        }
        
        const totalMinutes = Math.round((Date.now() - startTime) / 60000);
        throw new Error(`Deployment verification failed - entry not visible after ${totalMinutes} minutes`);
    }

    async fetchPageContent(url, redirectCount = 0) {
        const maxRedirects = 5;
        
        if (redirectCount >= maxRedirects) {
            throw new Error(`Too many redirects (${maxRedirects}) for ${url}`);
        }
        
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'llog-verification/1.0'
                },
                timeout: 10000
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.fetchPageContent(res.headers.location, redirectCount + 1).then(resolve).catch(reject);
                }
                
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.removeAllListeners();
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async run(args) {
        try {
            await this.acquireLock();
            await this.validateApiKey();

            const { url, tags } = this.parseArguments(args);
            console.log(`🚀 Processing URL: ${url}`);
            if (tags.length > 0) {
                console.log(`🏷️ Tags: ${tags.join(', ')}`);
            }

            // Store initial commit hash for potential rollback
            await this.storeInitialCommitHash();

            // Create backup of data file
            await this.createBackup(LINKLOG_DATA_FILE);

            // Load existing data
            const linklogData = await this.loadLinkLogData();

            // Check for duplicate URL
            const existingEntry = linklogData.entries.find(entry => entry.url === url);
            if (existingEntry) {
                throw new Error(`URL already exists in linklog with ID: ${existingEntry.id}`);
            }

            // Fetch page information
            const title = await this.fetchPageTitle(url);
            
            // Generate summary
            const summary = await this.generateSummary(url, title);
            
            // Combine user tags with suggested tags
            let finalTags = [...tags];
            if (finalTags.length === 0) {
                // If no user tags provided, use suggested tags
                const suggestedTags = await this.suggestTags(`${title} ${summary}`, []);
                finalTags = suggestedTags;
            } else {
                // If user provided tags, add suggested tags that aren't already present
                const suggestedTags = await this.suggestTags(`${title} ${summary}`, finalTags);
                for (const suggestedTag of suggestedTags) {
                    if (!finalTags.includes(suggestedTag)) {
                        finalTags.push(suggestedTag);
                    }
                }
            }

            // Create new entry
            const newEntry = {
                id: this.generateEntryId(),
                url,
                title,
                summary,
                tags: finalTags,
                dateAdded: new Date().toISOString()
            };

            // Add to data
            linklogData.entries.unshift(newEntry);
            await this.saveLinkLogData(linklogData);
            console.log(`✅ Added entry with ID: ${newEntry.id}`);

            // Build site
            await this.buildSite();

            // Commit and push
            await this.commitAndPush(url);

            // Verify deployment
            await this.verifyDeployment(newEntry.id);

            await this.cleanup();
            console.log('🎉 Link log entry successfully added and deployed!');

        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            await this.rollback();
            process.exit(1);
        }
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Process interrupted');
    if (global.linklogCLI) {
        await global.linklogCLI.rollback();
    }
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Process terminated');
    if (global.linklogCLI) {
        await global.linklogCLI.rollback();
    }
    process.exit(1);
});

// CLI setup
program
    .name('llog')
    .description('Add links to your link log')
    .argument('<url>', 'URL to add to the link log')
    .argument('[tags...]', 'Tags to associate with the link (prefix with #)')
    .action(async (url, tags) => {
        const cli = new LinkLogCLI();
        global.linklogCLI = cli;
        await cli.run([url, ...tags]);
    });

if (require.main === module) {
    program.parse();
}

module.exports = LinkLogCLI;