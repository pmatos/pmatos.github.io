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
    formData.append('content', contentInput.value);
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

[titleInput, descriptionInput, tagsInput, audienceNotesInput, contentInput].forEach(el => {
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
        return;
    }

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
            ${renderSuggestions(item.suggestions)}
        </div>
        `;
    }
    analysisContent.innerHTML = html;
}

function renderSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';

    let html = '<div class="suggestions"><strong>Suggestions:</strong>';
    for (const sugg of suggestions) {
        html += `
        <div class="suggestion suggestion-${sugg.type}">
            <span class="suggestion-type">${sugg.type}</span>
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
    if (!contentInput.value.trim()) {
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

window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

window.hidePublishModal = hidePublishModal;
