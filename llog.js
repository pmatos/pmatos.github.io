#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const LOCKFILE = path.join(__dirname, '.llog.lock');
const LINKLOG_DATA_FILE = path.join(__dirname, 'src/_11ty/_data/linklog.json');
const BACKUP_SUFFIX = '.backup';

class LinkLogCLI {
    constructor() {
        this.lockAcquired = false;
        this.backupFiles = [];
        this.gitStashApplied = false;
    }

    async acquireLock() {
        try {
            await fs.access(LOCKFILE);
            throw new Error('Another llog process is already running');
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(LOCKFILE, process.pid.toString());
                this.lockAcquired = true;
                console.log('📝 Acquired process lock');
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

        // Git reset if we made commits
        if (this.gitStashApplied) {
            try {
                execSync('git reset --hard HEAD~1', { stdio: 'pipe' });
                console.log('↩️ Reverted git commit');
            } catch (error) {
                console.error('❌ Failed to revert git commit:', error.message);
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

        const url = args[0];
        const tags = args.slice(1).filter(arg => arg.startsWith('#')).map(tag => tag.substring(1));

        // Basic URL validation
        try {
            new URL(url);
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }

        return { url, tags };
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

    async fetchPageTitle(url) {
        console.log(`🔍 Fetching page title from ${url}...`);
        
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000
            };

            const req = client.request(options, (res) => {
                let data = '';
                
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this.fetchPageTitle(res.headers.location).then(resolve).catch(reject);
                }
                
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }

                res.on('data', chunk => {
                    data += chunk;
                    // Stop reading after we have enough data to extract title
                    if (data.length > 50000) {
                        res.destroy();
                    }
                });

                res.on('end', () => {
                    try {
                        // Extract title from HTML
                        const titleMatch = data.match(/<title[^>]*>([^<]+)<\/title>/i);
                        let title = titleMatch ? titleMatch[1].trim() : urlObj.hostname;
                        
                        // Clean up title
                        title = title.replace(/\s+/g, ' ')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#039;/g, "'");

                        resolve(title);
                    } catch (error) {
                        resolve(urlObj.hostname);
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Failed to fetch ${url}: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Timeout fetching ${url}`));
            });

            req.end();
        });
    }

    async callClaudeAPI(prompt) {
        const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable not set');
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

    async suggestTags(content) {
        console.log('🏷️ Suggesting tags...');
        
        try {
            const prompt = `Based on this content, suggest 2-4 relevant tags (single words only, lowercase, no spaces):

${content}

Respond with only the tags separated by commas, like: programming, javascript, tutorial, web`;

            const response = await this.callClaudeAPI(prompt);
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

    async commitAndPush() {
        console.log('📤 Committing and pushing changes...');
        try {
            execSync('git add .', { stdio: 'pipe' });
            execSync('git commit -m "Add link to linklog"', { stdio: 'pipe' });
            this.gitStashApplied = true;
            execSync('git push origin main', { stdio: 'pipe' });
            console.log('✅ Changes committed and pushed');
        } catch (error) {
            throw new Error(`Git operations failed: ${error.message}`);
        }
    }

    async verifyDeployment(entryId) {
        console.log('🌐 Verifying online deployment...');
        
        // Get the site URL from meta.js or use GitHub Pages default
        let siteUrl;
        try {
            const metaFile = await fs.readFile(path.join(__dirname, 'src/_11ty/_data/meta.js'), 'utf8');
            const urlMatch = metaFile.match(/url:\s*(?:process\.env\.URL\s*\|\|\s*)?["']([^"']+)["']/);
            siteUrl = urlMatch ? urlMatch[1] : 'https://pmatos.github.io';
        } catch (error) {
            siteUrl = 'https://pmatos.github.io';
        }

        const linklogUrl = `${siteUrl}/linklog.html`;
        const maxAttempts = 20; // 10 minutes with 30s intervals
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`📡 Checking deployment (attempt ${attempt}/${maxAttempts})...`);
                
                const pageContent = await this.fetchPageContent(linklogUrl);
                
                // Check if our entry ID appears in the page
                if (pageContent.includes(entryId)) {
                    console.log('✅ Deployment verified - entry is live!');
                    return true;
                }
                
                if (attempt < maxAttempts) {
                    console.log('⏳ Entry not yet visible, waiting 30 seconds...');
                    await this.sleep(30000);
                }
                
            } catch (error) {
                console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxAttempts) {
                    await this.sleep(30000);
                }
            }
        }
        
        throw new Error('Deployment verification failed - entry not visible after 10 minutes');
    }

    async fetchPageContent(url) {
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
                    return this.fetchPageContent(res.headers.location).then(resolve).catch(reject);
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

            const { url, tags } = this.parseArguments(args);
            console.log(`🚀 Processing URL: ${url}`);
            if (tags.length > 0) {
                console.log(`🏷️ Tags: ${tags.join(', ')}`);
            }

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
            
            // Suggest additional tags if none provided
            let finalTags = [...tags];
            if (finalTags.length === 0) {
                const suggestedTags = await this.suggestTags(`${title} ${summary}`);
                finalTags = suggestedTags;
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
            await this.commitAndPush();

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