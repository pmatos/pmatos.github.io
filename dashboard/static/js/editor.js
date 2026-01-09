const draftId = document.getElementById('title').dataset.draftId;

const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const tagsInput = document.getElementById('tags');
const audienceNotesInput = document.getElementById('audience-notes');
const contentInput = document.getElementById('content');
const saveBtn = document.getElementById('save-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const publishBtn = document.getElementById('publish-btn');
const analysisContent = document.getElementById('analysis-content');

let saveTimeout = null;
let isDirty = false;
let easyMDE = null;
let currentAnalysis = null;

function initEditor() {
    try {
        easyMDE = new EasyMDE({
            element: contentInput,
            spellChecker: false,
            autosave: { enabled: false },
            toolbar: false,
            status: false,
            minHeight: '400px'
        });

        easyMDE.codemirror.on('change', () => {
            autoSave();
        });
    } catch (e) {
        console.error('EasyMDE init error:', e);
        document.querySelector('.editor-main').innerHTML =
            '<p style="color: var(--color-danger); padding: 1rem;">Failed to load editor. Please refresh the page.</p>';
    }
}

function getEditorContent() {
    return easyMDE ? easyMDE.value() : contentInput.value;
}

function insertAtCursor(text) {
    if (!easyMDE) return;
    const cm = easyMDE.codemirror;
    const cursor = cm.getCursor();
    cm.replaceRange(text, cursor);
    cm.focus();
}

function markDirty() {
    isDirty = true;
    saveBtn.textContent = 'Save *';
}

function markClean() {
    isDirty = false;
    saveBtn.textContent = 'Save';
}

async function saveDraft() {
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    const formData = new FormData();
    formData.append('title', titleInput.value);
    formData.append('description', descriptionInput.value);
    formData.append('tags', tagsInput.value);
    formData.append('content', getEditorContent());
    formData.append('audience_notes', audienceNotesInput.value);

    try {
        const response = await fetch(`/api/drafts/${draftId}`, {
            method: 'PUT',
            body: formData
        });

        if (response.ok) {
            markClean();
        } else {
            const error = await response.json();
            alert('Save failed: ' + (error.detail || 'Unknown error'));
        }
    } catch (e) {
        alert('Save failed: ' + e.message);
    } finally {
        saveBtn.disabled = false;
        if (!isDirty) saveBtn.textContent = 'Save';
    }
}

function autoSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    markDirty();
    saveTimeout = setTimeout(saveDraft, 2000);
}

[titleInput, descriptionInput, tagsInput, audienceNotesInput].forEach(el => {
    el.addEventListener('input', autoSave);
});

saveBtn.addEventListener('click', () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveDraft();
});

analyzeBtn.addEventListener('click', async () => {
    if (isDirty) {
        await saveDraft();
    }

    analyzeBtn.textContent = 'Analyzing...';
    analyzeBtn.disabled = true;
    analysisContent.innerHTML = '<p class="empty-state">Analyzing your paragraphs with AI...</p>';

    try {
        const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft_id: parseInt(draftId) })
        });

        if (response.ok) {
            const data = await response.json();
            renderAnalysis(data.analysis);
        } else {
            const error = await response.json();
            analysisContent.innerHTML = `<p class="empty-state" style="color: var(--danger)">Analysis failed: ${error.detail || 'Unknown error'}</p>`;
        }
    } catch (e) {
        analysisContent.innerHTML = `<p class="empty-state" style="color: var(--danger)">Analysis failed: ${e.message}</p>`;
    } finally {
        analyzeBtn.textContent = 'Analyze';
        analyzeBtn.disabled = false;
    }
});

function renderAnalysis(analysis) {
    if (!analysis || analysis.length === 0) {
        analysisContent.innerHTML = '<p class="empty-state">No paragraphs to analyze.</p>';
        currentAnalysis = null;
        return;
    }

    currentAnalysis = analysis;
    let html = '';
    for (const item of analysis) {
        const ratingClass = item.overall_rating.replace(/_/g, '-');
        html += `
        <div class="analysis-item">
            <div class="analysis-header">
                <span class="analysis-index">Paragraph ${item.paragraph_index + 1}</span>
                <span class="rating-badge rating-${ratingClass}">${item.overall_rating.replace(/_/g, ' ')}</span>
            </div>
            <p class="analysis-paragraph">${escapeHtml(item.paragraph_text.substring(0, 150))}${item.paragraph_text.length > 150 ? '...' : ''}</p>
            <p class="analysis-summary"><strong>Summary:</strong> ${escapeHtml(item.summary)}</p>
            <p class="analysis-flow"><strong>Flow:</strong> ${escapeHtml(item.flow_with_context)}</p>
            ${renderSuggestions(item.suggestions, item.paragraph_index, item.paragraph_text)}
        </div>
        `;
    }
    analysisContent.innerHTML = html;
}

function renderSuggestions(suggestions, paragraphIndex, originalText) {
    if (!suggestions || suggestions.length === 0) return '';

    let html = '<div class="suggestions"><strong>Suggestions:</strong>';
    for (let i = 0; i < suggestions.length; i++) {
        const sugg = suggestions[i];
        const canApply = sugg.type === 'rewrite' && sugg.example;
        html += `
        <div class="suggestion suggestion-${sugg.type}">
            <div class="suggestion-header">
                <span class="suggestion-type">${sugg.type}</span>
                ${canApply ? `<button type="button" class="btn-apply" onclick="applySuggestion(${paragraphIndex}, ${i})">Apply</button>` : ''}
            </div>
            <p>${escapeHtml(sugg.description)}</p>
            ${sugg.example ? `<pre class="suggestion-example">${escapeHtml(sugg.example)}</pre>` : ''}
        </div>
        `;
    }
    html += '</div>';
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applySuggestion(paragraphIndex, suggestionIndex) {
    if (!currentAnalysis) {
        alert('No analysis data available. Please run analysis first.');
        return;
    }

    const analysisItem = currentAnalysis.find(a => a.paragraph_index === paragraphIndex);
    if (!analysisItem) {
        alert('Could not find the paragraph in analysis data.');
        return;
    }

    const suggestion = analysisItem.suggestions[suggestionIndex];
    if (!suggestion || !suggestion.example) {
        alert('This suggestion has no example text to apply.');
        return;
    }

    const content = getEditorContent();
    const paragraphs = content.split('\n\n');

    if (paragraphIndex >= paragraphs.length) {
        alert('Paragraph index out of range. The content may have changed since analysis.');
        return;
    }

    const currentParagraph = paragraphs[paragraphIndex].trim();
    const originalParagraph = analysisItem.paragraph_text.trim();

    if (currentParagraph !== originalParagraph) {
        const proceed = confirm(
            'The paragraph has been modified since the analysis was run.\n\n' +
            'Do you want to apply the suggestion anyway?\n\n' +
            'Click OK to replace the current paragraph, or Cancel to abort.'
        );
        if (!proceed) return;
    }

    paragraphs[paragraphIndex] = suggestion.example;
    const newContent = paragraphs.join('\n\n');

    easyMDE.value(newContent);
    autoSave();

    const btn = event.target;
    btn.textContent = 'Applied';
    btn.disabled = true;
    btn.classList.add('btn-applied');
}

window.applySuggestion = applySuggestion;

const publishModal = document.getElementById('publish-modal');
const publishTitle = document.getElementById('publish-title');
const confirmPublishBtn = document.getElementById('confirm-publish-btn');
const publishStatus = document.getElementById('publish-status');

function showPublishModal() {
    publishTitle.textContent = titleInput.value;
    publishStatus.innerHTML = '';
    publishModal.style.display = 'flex';
}

function hidePublishModal() {
    publishModal.style.display = 'none';
}

publishBtn.addEventListener('click', async () => {
    if (isDirty) {
        await saveDraft();
    }

    if (!titleInput.value.trim()) {
        alert('Please add a title before publishing.');
        return;
    }
    if (!getEditorContent().trim()) {
        alert('Please add content before publishing.');
        return;
    }

    showPublishModal();
});

confirmPublishBtn.addEventListener('click', async () => {
    confirmPublishBtn.textContent = 'Publishing...';
    confirmPublishBtn.disabled = true;
    publishStatus.innerHTML = '<p>Creating file, building site, committing...</p>';

    try {
        const response = await fetch(`/api/drafts/${draftId}/publish`, {
            method: 'POST'
        });

        if (response.ok) {
            const data = await response.json();
            publishStatus.innerHTML = `<p style="color: var(--success)">Published successfully to ${data.path}</p>`;
            setTimeout(() => {
                window.location.href = '/drafts';
            }, 2000);
        } else {
            const error = await response.json();
            publishStatus.innerHTML = `<p style="color: var(--danger)">Publish failed: ${error.detail || 'Unknown error'}</p>`;
        }
    } catch (e) {
        publishStatus.innerHTML = `<p style="color: var(--danger)">Publish failed: ${e.message}</p>`;
    } finally {
        confirmPublishBtn.textContent = 'Publish';
        confirmPublishBtn.disabled = false;
    }
});

const imageModal = document.getElementById('image-modal');
const videoModal = document.getElementById('video-modal');
const toolbarImage = document.getElementById('toolbar-image');
const toolbarVideo = document.getElementById('toolbar-video');

let pendingImageFile = null;
let pendingVideoFile = null;

function showImageModal() {
    pendingImageFile = null;
    document.getElementById('image-file-input').value = '';
    document.getElementById('image-url-input').value = '';
    document.getElementById('image-alt-input').value = '';
    document.getElementById('image-upload-preview').style.display = 'none';
    document.getElementById('image-url-preview').style.display = 'none';
    document.getElementById('image-status').innerHTML = '';
    document.getElementById('image-upload-zone').style.display = 'block';
    switchImageTab('upload');
    imageModal.style.display = 'flex';
}

function hideImageModal() {
    imageModal.style.display = 'none';
    pendingImageFile = null;
}

function showVideoModal() {
    pendingVideoFile = null;
    document.getElementById('video-file-input').value = '';
    document.getElementById('youtube-url-input').value = '';
    document.getElementById('video-upload-preview').style.display = 'none';
    document.getElementById('youtube-preview').style.display = 'none';
    document.getElementById('video-status').innerHTML = '';
    document.getElementById('video-upload-zone').style.display = 'block';
    switchVideoTab('youtube');
    videoModal.style.display = 'flex';
}

function hideVideoModal() {
    videoModal.style.display = 'none';
    pendingVideoFile = null;
}

function switchImageTab(tab) {
    document.querySelectorAll('#image-modal .modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#image-modal .modal-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('image-tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
    document.getElementById('image-tab-url').style.display = tab === 'url' ? 'block' : 'none';
}

function switchVideoTab(tab) {
    document.querySelectorAll('#video-modal .modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`#video-modal .modal-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('video-tab-youtube').style.display = tab === 'youtube' ? 'block' : 'none';
    document.getElementById('video-tab-upload').style.display = tab === 'upload' ? 'block' : 'none';
}

toolbarImage.addEventListener('click', showImageModal);
toolbarVideo.addEventListener('click', showVideoModal);

document.querySelectorAll('#image-modal .modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchImageTab(tab.dataset.tab));
});

document.querySelectorAll('#video-modal .modal-tab').forEach(tab => {
    tab.addEventListener('click', () => switchVideoTab(tab.dataset.tab));
});

const imageUploadZone = document.getElementById('image-upload-zone');
const imageFileInput = document.getElementById('image-file-input');

imageUploadZone.addEventListener('click', () => imageFileInput.click());

imageUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imageUploadZone.classList.add('drag-over');
});

imageUploadZone.addEventListener('dragleave', () => {
    imageUploadZone.classList.remove('drag-over');
});

imageUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    imageUploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    }
});

imageFileInput.addEventListener('change', () => {
    if (imageFileInput.files[0]) {
        handleImageFile(imageFileInput.files[0]);
    }
});

function handleImageFile(file) {
    pendingImageFile = file;
    const preview = document.getElementById('image-upload-preview');
    const previewImg = document.getElementById('image-preview-img');
    const previewName = document.getElementById('image-preview-name');

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        preview.style.display = 'block';
        imageUploadZone.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

const imageUrlInput = document.getElementById('image-url-input');
imageUrlInput.addEventListener('input', () => {
    const url = imageUrlInput.value.trim();
    const preview = document.getElementById('image-url-preview');
    const previewImg = document.getElementById('image-url-preview-img');

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        previewImg.src = url;
        previewImg.onload = () => { preview.style.display = 'block'; };
        previewImg.onerror = () => { preview.style.display = 'none'; };
    } else {
        preview.style.display = 'none';
    }
});

document.getElementById('insert-image-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('image-status');
    const altText = document.getElementById('image-alt-input').value.trim() || 'image';
    const activeTab = document.querySelector('#image-modal .modal-tab.active').dataset.tab;

    if (activeTab === 'upload' && pendingImageFile) {
        statusEl.innerHTML = '<p>Uploading...</p>';
        const formData = new FormData();
        formData.append('file', pendingImageFile);

        try {
            const response = await fetch(`/api/drafts/${draftId}/media`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                insertAtCursor(`![${altText}](${data.path})`);
                hideImageModal();
            } else {
                const error = await response.json();
                statusEl.innerHTML = `<p style="color: var(--color-danger)">Upload failed: ${error.detail || 'Unknown error'}</p>`;
            }
        } catch (e) {
            statusEl.innerHTML = `<p style="color: var(--color-danger)">Upload failed: ${e.message}</p>`;
        }
    } else if (activeTab === 'url') {
        const url = document.getElementById('image-url-input').value.trim();
        if (url) {
            insertAtCursor(`![${altText}](${url})`);
            hideImageModal();
        } else {
            statusEl.innerHTML = '<p style="color: var(--color-danger)">Please enter a URL</p>';
        }
    } else {
        statusEl.innerHTML = '<p style="color: var(--color-danger)">Please select or upload an image</p>';
    }
});

const videoUploadZone = document.getElementById('video-upload-zone');
const videoFileInput = document.getElementById('video-file-input');

videoUploadZone.addEventListener('click', () => videoFileInput.click());

videoUploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    videoUploadZone.classList.add('drag-over');
});

videoUploadZone.addEventListener('dragleave', () => {
    videoUploadZone.classList.remove('drag-over');
});

videoUploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    videoUploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'video/mp4' || file.type === 'video/webm')) {
        handleVideoFile(file);
    }
});

videoFileInput.addEventListener('change', () => {
    if (videoFileInput.files[0]) {
        handleVideoFile(videoFileInput.files[0]);
    }
});

function handleVideoFile(file) {
    if (file.size > 50 * 1024 * 1024) {
        document.getElementById('video-status').innerHTML = '<p style="color: var(--color-danger)">File too large. Maximum size is 50MB.</p>';
        return;
    }
    pendingVideoFile = file;
    const preview = document.getElementById('video-upload-preview');
    const previewEl = document.getElementById('video-preview-element');
    const previewName = document.getElementById('video-preview-name');

    previewEl.src = URL.createObjectURL(file);
    previewName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
    preview.style.display = 'block';
    videoUploadZone.style.display = 'none';
}

const youtubeUrlInput = document.getElementById('youtube-url-input');
youtubeUrlInput.addEventListener('input', () => {
    const url = youtubeUrlInput.value.trim();
    const videoId = extractYouTubeId(url);
    const preview = document.getElementById('youtube-preview');
    const thumbnail = document.getElementById('youtube-thumbnail');

    if (videoId) {
        thumbnail.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
});

function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

document.getElementById('insert-video-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('video-status');
    const activeTab = document.querySelector('#video-modal .modal-tab.active').dataset.tab;

    if (activeTab === 'youtube') {
        const url = document.getElementById('youtube-url-input').value.trim();
        const videoId = extractYouTubeId(url);
        if (videoId) {
            const embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            insertAtCursor('\n' + embedCode + '\n');
            hideVideoModal();
        } else {
            statusEl.innerHTML = '<p style="color: var(--color-danger)">Please enter a valid YouTube URL</p>';
        }
    } else if (activeTab === 'upload' && pendingVideoFile) {
        statusEl.innerHTML = '<p>Uploading...</p>';
        const formData = new FormData();
        formData.append('file', pendingVideoFile);

        try {
            const response = await fetch(`/api/drafts/${draftId}/media`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                const videoHtml = `<video src="${data.path}" controls style="max-width: 100%;"></video>`;
                insertAtCursor('\n' + videoHtml + '\n');
                hideVideoModal();
            } else {
                const error = await response.json();
                statusEl.innerHTML = `<p style="color: var(--color-danger)">Upload failed: ${error.detail || 'Unknown error'}</p>`;
            }
        } catch (e) {
            statusEl.innerHTML = `<p style="color: var(--color-danger)">Upload failed: ${e.message}</p>`;
        }
    } else {
        statusEl.innerHTML = '<p style="color: var(--color-danger)">Please enter a YouTube URL or upload a video</p>';
    }
});

window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

window.hidePublishModal = hidePublishModal;
window.hideImageModal = hideImageModal;
window.hideVideoModal = hideVideoModal;

initEditor();
