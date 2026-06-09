/**
 * 达人账号内容分析工具 - 前端应用
 * 苹果风格 UI + AI 分析功能
 */

// API 基础URL
const API_BASE = '';
const API_TOKEN = localStorage.getItem('apiToken') || '';
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (API_TOKEN) {
        headers.set('X-API-Token', API_TOKEN);
    }
    return originalFetch(input, { ...init, headers });
};

// 全局状态
const state = {
    accounts: [],
    taskId: null,
    taskStatus: null,
    isRunning: false,
    crawlResults: null,
    aiEnabled: false,
    config: {
        maxContents: 10,
        platforms: ['xiaohongshu', 'douyin'],
        minDelay: 3,
        maxDelay: 6
    }
};

// DOM 元素
const elements = {};

// 初始化
function init() {
    cacheElements();
    bindEvents();
    render();
    loadPlatforms();
    checkAIStatus();
}

// 缓存DOM元素
function cacheElements() {
    elements.root = document.getElementById('root');
    elements.fileInput = document.getElementById('fileInput');
    elements.uploadZone = document.getElementById('uploadZone');
    elements.accountList = document.getElementById('accountList');
    elements.startBtn = document.getElementById('startBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.progressContainer = document.getElementById('progressContainer');
    elements.resultContainer = document.getElementById('resultContainer');
}

// 绑定事件
function bindEvents() {
    // 文件上传
    if (elements.uploadZone) {
        elements.uploadZone.addEventListener('click', () => {
            elements.fileInput?.click();
        });
        
        elements.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.add('dragover');
        });
        
        elements.uploadZone.addEventListener('dragleave', () => {
            elements.uploadZone.classList.remove('dragover');
        });
        
        elements.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        });
    }
    
    // 文件选择
    elements.fileInput?.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // 开始采集
    elements.startBtn?.addEventListener('click', startCrawl);
    
    // 清空列表
    elements.clearBtn?.addEventListener('click', clearAccounts);
    
    // 预登录相关按钮
    document.getElementById('checkCookieBtn')?.addEventListener('click', checkPreloginCookie);
    document.getElementById('preloginBtn')?.addEventListener('click', startPrelogin);
    document.getElementById('confirmLoginBtn')?.addEventListener('click', confirmPrelogin);
    document.getElementById('cancelLoginBtn')?.addEventListener('click', cancelPrelogin);
}

// 检查 AI 状态
async function checkAIStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/ai/status`);
        const data = await response.json();
        state.aiEnabled = data.enabled;
        console.log('AI 状态:', data.message);
    } catch (error) {
        console.error('检查 AI 状态失败:', error);
    }
}

// 处理文件上传
async function handleFileUpload(file) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
        showNotification('请上传 Excel 或 CSV 文件', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showLoading('正在解析文件...');
        
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.accounts = data.accounts;
            console.log('导入账号:', state.accounts);
            console.log('账号数量:', state.accounts.length);
            render(); // 重新渲染整个页面以显示采集设置
            renderAccountList();
            showNotification(`成功导入 ${data.total} 个账号`, 'success');
        } else {
            showNotification(data.message || '导入失败', 'error');
        }
    } catch (error) {
        showNotification('文件上传失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 检查预登录Cookie状态
async function checkPreloginCookie() {
    try {
        const response = await fetch(`${API_BASE}/api/prelogin/check-cookie`);
        const data = await response.json();
        
        const statusDiv = document.getElementById('preloginStatus');
        if (data.has_cookie) {
            statusDiv.innerHTML = '<span style="color: var(--ios-green);">✓ ' + data.message + '</span>';
            showNotification('已存在登录Cookie，可以直接采集', 'success');
        } else {
            statusDiv.innerHTML = '<span style="color: var(--ios-orange);">⚠ ' + data.message + '</span>';
            showNotification('未找到Cookie，请先进行预登录', 'warning');
        }
    } catch (error) {
        showNotification('检查Cookie失败: ' + error.message, 'error');
    }
}

// 预登录状态标志
let isPreloginStarting = false;

// 开始预登录
async function startPrelogin() {
    // 防止重复点击
    if (isPreloginStarting) {
        console.log('预登录已在进行中，忽略重复点击');
        return;
    }
    
    isPreloginStarting = true;
    
    try {
        showLoading('正在启动预登录，请等待浏览器弹出...');
        
        const response = await fetch(`${API_BASE}/api/prelogin/start`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.task_id) {
            showNotification('浏览器已打开，请在浏览器中完成登录', 'success');
            hideLoading();
            
            // 切换按钮显示
            document.getElementById('preloginInitialBtns').style.display = 'none';
            document.getElementById('preloginActiveBtns').style.display = 'flex';
            
            const statusDiv = document.getElementById('preloginStatus');
            statusDiv.innerHTML = '<span style="color: var(--ios-blue);">⏳ 浏览器已打开，请在浏览器中完成登录，然后点击"确认已登录"</span>';
        } else {
            throw new Error('启动预登录失败');
        }
    } catch (error) {
        showNotification('预登录启动失败: ' + error.message, 'error');
        hideLoading();
    } finally {
        // 3秒后重置标志，允许再次点击
        setTimeout(() => {
            isPreloginStarting = false;
        }, 3000);
    }
}

// 确认已登录
async function confirmPrelogin() {
    try {
        showLoading('正在保存登录状态...');
        
        const response = await fetch(`${API_BASE}/api/prelogin/confirm`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message, 'success');
            
            // 切换按钮显示
            document.getElementById('preloginInitialBtns').style.display = 'flex';
            document.getElementById('preloginActiveBtns').style.display = 'none';
            
            const statusDiv = document.getElementById('preloginStatus');
            statusDiv.innerHTML = '<span style="color: var(--ios-green);">✓ ' + data.message + '</span>';
        } else {
            showNotification(data.message, 'warning');
        }
    } catch (error) {
        showNotification('确认登录失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 取消预登录
async function cancelPrelogin() {
    try {
        const response = await fetch(`${API_BASE}/api/prelogin/cancel`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        // 切换按钮显示
        document.getElementById('preloginInitialBtns').style.display = 'flex';
        document.getElementById('preloginActiveBtns').style.display = 'none';
        
        const statusDiv = document.getElementById('preloginStatus');
        statusDiv.innerHTML = '<span style="color: var(--ios-gray);">已取消预登录</span>';
        
        showNotification(data.message, 'info');
    } catch (error) {
        showNotification('取消失败: ' + error.message, 'error');
    }
}

// 开始采集
async function startCrawl() {
    if (state.accounts.length === 0) {
        showNotification('请先导入账号列表', 'error');
        return;
    }
    
    if (state.isRunning) {
        showNotification('采集任务正在进行中', 'warning');
        return;
    }
    
    const urls = state.accounts.map(a => a.url).filter(Boolean);
    
    if (urls.length === 0) {
        showNotification('没有有效的账号链接', 'error');
        return;
    }

    const hasPgyUrl = urls.some(url => url.includes('pgy.xiaohongshu.com') || url.includes('blogger-detail'));
    if (hasPgyUrl) {
        try {
            const validateResponse = await fetch(`${API_BASE}/api/prelogin/validate-login`);
            const validateData = await validateResponse.json();
            if (!validateData.success || !validateData.is_valid) {
                const statusDiv = document.getElementById('preloginStatus');
                if (statusDiv) {
                    statusDiv.innerHTML = '<span style="color: var(--ios-orange);">⚠ ' + (validateData.message || '登录态无效，请先预登录') + '</span>';
                }
                showNotification(validateData.message || '检测到蒲公英链接，但登录态无效，请先预登录', 'warning');
                return;
            }
        } catch (error) {
            showNotification('校验蒲公英登录态失败: ' + error.message, 'error');
            return;
        }
    }
    
    try {
        state.isRunning = true;
        updateUIState();
        
        const response = await fetch(`${API_BASE}/api/crawl/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                urls: urls,
                max_contents: state.config.maxContents,
                platforms: state.config.platforms
            })
        });
        
        const data = await response.json();
        
        if (data.task_id) {
            state.taskId = data.task_id;
            showNotification('采集任务已启动', 'success');
            startStatusPolling();
        } else {
            throw new Error('启动任务失败');
        }
    } catch (error) {
        showNotification('启动任务失败: ' + error.message, 'error');
        state.isRunning = false;
        updateUIState();
    }
}

// 轮询任务状态
function startStatusPolling() {
    const pollInterval = setInterval(async () => {
        if (!state.taskId || !state.isRunning) {
            clearInterval(pollInterval);
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/crawl/status/${state.taskId}`);
            const status = await response.json();
            
            state.taskStatus = status;
            updateProgress(status);
            
            if (status.status === 'completed' || status.status === 'failed') {
                clearInterval(pollInterval);
                state.isRunning = false;
                state.crawlResults = status.result;
                updateUIState();
                
                if (status.status === 'completed') {
                    showNotification('采集任务完成', 'success');
                    renderResults(status);
                } else {
                    showNotification('采集任务失败: ' + status.message, 'error');
                }
            }
        } catch (error) {
            console.error('获取任务状态失败:', error);
        }
    }, 2000);
}

// 更新进度显示
function updateProgress(status) {
    const progressContainer = elements.progressContainer;
    if (!progressContainer) return;
    
    const percentage = status.total > 0 ? (status.progress / status.total) * 100 : 0;
    
    progressContainer.innerHTML = `
        <div class="card animate-fade-in">
            <div class="card-header">
                <h3 class="card-title">采集进度</h3>
                <span class="status-badge status-${status.status}">
                    ${getStatusText(status.status)}
                </span>
            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-info">
                    <span>${status.message}</span>
                    <span>${status.progress} / ${status.total}</span>
                </div>
            </div>
        </div>
    `;
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ 等待中',
        'running': '🔄 采集中',
        'completed': '✅ 已完成',
        'failed': '❌ 失败'
    };
    return statusMap[status] || status;
}

// ==================== AI 分析功能 ====================

// AI 分析单条内容
async function analyzeContent(content, contentType = '笔记') {
    try {
        showLoading('AI 分析中...');
        
        const response = await fetch(`${API_BASE}/api/ai/analyze-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                content_type: contentType
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            showNotification('AI 分析失败: ' + (data.error || '未知错误'), 'error');
            return null;
        }
    } catch (error) {
        showNotification('AI 分析请求失败: ' + error.message, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

// AI 分析用户画像
async function analyzeUserProfile(userData) {
    try {
        showLoading('AI 分析用户画像...');
        
        const response = await fetch(`${API_BASE}/api/ai/analyze-user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_data: userData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            showNotification('用户画像分析失败: ' + (data.error || '未知错误'), 'error');
            return null;
        }
    } catch (error) {
        showNotification('用户画像分析请求失败: ' + error.message, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

// AI 对比多个用户
async function compareUsersAI(usersData) {
    try {
        showLoading('AI 对比分析中...');
        
        const response = await fetch(`${API_BASE}/api/ai/compare-users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                users_data: usersData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            showNotification('对比分析失败: ' + (data.error || '未知错误'), 'error');
            return null;
        }
    } catch (error) {
        showNotification('对比分析请求失败: ' + error.message, 'error');
        return null;
    } finally {
        hideLoading();
    }
}

// AI 生成整体报告
async function generateAIReport() {
    if (!state.crawlResults || state.crawlResults.length === 0) {
        showNotification('暂无采集数据，请先完成采集任务', 'warning');
        return;
    }
    
    try {
        showLoading('AI 生成报告中...');
        
        const response = await fetch(`${API_BASE}/api/ai/generate-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                crawl_data: state.crawlResults
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAIReportModal(data.report);
        } else {
            showNotification('报告生成失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (error) {
        showNotification('报告生成请求失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 显示 AI 分析报告弹窗
function showAIReportModal(report) {
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content">
            <div class="ai-modal-header">
                <h3>🤖 AI 智能分析报告</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <div class="ai-report-content">
                    ${marked.parse(report)}
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
                <button class="btn btn-primary" onclick="downloadReport()">下载报告</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 关闭按钮事件
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 显示内容分析弹窗
async function showContentAnalysis(content, title) {
    const analysis = await analyzeContent(content);
    
    if (!analysis) return;
    
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content">
            <div class="ai-modal-header">
                <h3>📝 内容 AI 分析</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <div class="content-preview">
                    <h4>原文内容</h4>
                    <p>${title || content.substring(0, 200)}${content.length > 200 ? '...' : ''}</p>
                </div>
                <div class="analysis-result">
                    <div class="analysis-item">
                        <span class="analysis-label">📋 摘要</span>
                        <span class="analysis-value">${analysis.summary}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">🔑 关键词</span>
                        <span class="analysis-value">
                            ${analysis.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
                        </span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">😊 情感倾向</span>
                        <span class="analysis-value sentiment-${analysis.sentiment}">${analysis.sentiment}</span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">🏷️ 标签</span>
                        <span class="analysis-value">
                            ${analysis.tags.map(t => `<span class="tag tag-primary">${t}</span>`).join('')}
                        </span>
                    </div>
                    <div class="analysis-item">
                        <span class="analysis-label">💡 建议</span>
                        <span class="analysis-value">${analysis.suggestions}</span>
                    </div>
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 渲染结果（包含 AI 分析按钮）
function renderResults(status) {
    const container = elements.resultContainer;
    if (!container || !status.output_files) return;
    
    const files = status.output_files;
    const hasAI = state.aiEnabled;
    
    container.innerHTML = `
        <div class="card animate-fade-in">
            <div class="card-header">
                <h3 class="card-title">采集结果</h3>
            </div>
            <p style="margin-bottom: 16px; color: var(--ios-gray);">
                成功采集 ${status.result?.length || 0} 个账号的数据
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                ${files.excel ? `
                    <a href="${API_BASE}/api/download/${encodeURIComponent(files.excel.split('/').pop())}" 
                       class="btn btn-success" download>
                        📊 下载 Excel 报告
                    </a>
                ` : ''}
                ${files.json ? `
                    <a href="${API_BASE}/api/download/${encodeURIComponent(files.json.split('/').pop())}" 
                       class="btn btn-secondary" download>
                        📄 下载 JSON 数据
                    </a>
                ` : ''}
            </div>
            
            <!-- 数据已本地保存提示 -->
            <div class="local-storage-notice" style="background: rgba(52, 199, 89, 0.1); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
                <p style="margin: 0; font-size: 13px; color: var(--ios-green);">
                    ✅ 数据已安全保存在本地：${files.json ? files.json.split('/').pop() : ''}
                </p>
            </div>
            
            ${hasAI ? `
                <div class="ai-section" style="border-top: 1px solid var(--ios-border); padding-top: 16px; margin-top: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <h4 style="color: var(--ios-blue); margin: 0;">🤖 AI 智能分析（可选）</h4>
                        <span class="privacy-badge" style="background: var(--ios-orange); color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">隐私提示</span>
                    </div>
                    
                    <!-- 隐私警告 -->
                    <div class="privacy-warning" style="background: #FFF3CD; border: 1px solid #FFEEBA; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <p style="margin: 0 0 8px 0; font-size: 13px; color: #856404; font-weight: 500;">
                            ⚠️ 隐私提示
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #856404; line-height: 1.5;">
                            使用 AI 分析功能会将内容发送到第三方 API (comfly.chat) 进行处理。<br>
                            如果您采集的是敏感数据，建议先下载到本地，再自行决定如何处理。
                        </p>
                    </div>
                    
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="showAIPrivacyConfirm('report')">
                            📊 生成整体分析报告
                        </button>
                        <button class="btn btn-secondary" onclick="showAIPrivacyConfirm('user')">
                            👤 查看用户画像分析
                        </button>
                        <button class="btn btn-secondary" onclick="showAIPrivacyConfirm('compare')">
                            📈 对比分析
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <!-- 本地预览（不包含 AI 分析按钮） -->
        ${status.result ? renderLocalPreview(status.result) : ''}
    `;
}

// 显示 AI 隐私确认对话框
function showAIPrivacyConfirm(type) {
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 500px;">
            <div class="ai-modal-header">
                <h3>⚠️ 隐私确认</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <div class="privacy-confirm-content">
                    <p style="margin-bottom: 16px; line-height: 1.6;">
                        您即将使用 AI 分析功能，这会将采集的内容数据发送到第三方 API (comfly.chat) 进行处理。
                    </p>
                    
                    <div style="background: var(--ios-light-gray); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">数据流向：</p>
                        <p style="margin: 0; font-size: 13px; color: var(--ios-gray); line-height: 1.6;">
                            您的数据 → 本应用服务器 → comfly.chat API (第三方)
                        </p>
                    </div>
                    
                    <p style="margin-bottom: 16px; font-size: 13px; color: var(--ios-gray);">
                        如果您不希望数据离开本地，请点击"取消"，直接使用下载的 Excel/JSON 文件。
                    </p>
                    
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="privacyAgree" style="width: 18px; height: 18px; accent-color: var(--ios-blue);">
                        <span style="font-size: 14px;">我理解并同意将数据发送到第三方 API 进行分析</span>
                    </label>
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">取消</button>
                <button class="btn btn-primary" id="confirmAIBtn" disabled onclick="executeAIAnalysis('${type}')">确认使用 AI 分析</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 复选框事件
    const checkbox = modal.querySelector('#privacyAgree');
    const confirmBtn = modal.querySelector('#confirmAIBtn');
    
    checkbox.addEventListener('change', (e) => {
        confirmBtn.disabled = !e.target.checked;
    });
    
    // 关闭按钮
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 执行 AI 分析
function executeAIAnalysis(type) {
    // 关闭确认对话框
    document.querySelector('.ai-modal')?.remove();
    
    // 根据类型执行不同的分析
    switch(type) {
        case 'report':
            generateAIReport();
            break;
        case 'user':
            showUserAnalysis();
            break;
        case 'compare':
            showCompareAnalysis();
            break;
    }
}

// 渲染本地预览（不包含 AI 分析按钮）
function renderLocalPreview(results) {
    if (!results || results.length === 0) return '';
    
    return `
        <div class="card animate-fade-in" style="margin-top: 20px;">
            <div class="card-header">
                <h3 class="card-title">采集内容预览</h3>
            </div>
            <div class="content-preview-list">
                ${results.map((user, userIdx) => {
                    const contents = user.notes || user.videos || [];
                    return contents.slice(0, 3).map((content, idx) => `
                        <div class="content-preview-item">
                            <div class="content-preview-header">
                                <span class="content-author">${user.nickname}</span>
                                <span class="content-platform">${user.platform}</span>
                            </div>
                            <div class="content-preview-title">${content.title || '无标题'}</div>
                            <div class="content-preview-meta">
                                <span>❤️ ${content.interactions?.likes || 0}</span>
                                <span>💬 ${content.interactions?.comments || 0}</span>
                                <span>⭐ ${content.interactions?.collects || 0}</span>
                            </div>
                        </div>
                    `).join('');
                }).join('')}
            </div>
        </div>
    `;
}

// 渲染 AI 结果预览（仅在用户确认后使用）
function renderAIResultsPreview(results) {
    if (!results || results.length === 0) return '';
    
    return `
        <div class="card animate-fade-in" style="margin-top: 20px;">
            <div class="card-header">
                <h3 class="card-title">采集内容预览（可点击进行 AI 分析）</h3>
            </div>
            <div class="content-preview-list">
                ${results.map((user, userIdx) => {
                    const contents = user.notes || user.videos || [];
                    return contents.slice(0, 3).map((content, idx) => `
                        <div class="content-preview-item" onclick="showContentAnalysisWithConfirm('${encodeURIComponent(content.title || '')}', '${encodeURIComponent(content.title || '').substring(0, 50)}')">
                            <div class="content-preview-header">
                                <span class="content-author">${user.nickname}</span>
                                <span class="content-platform">${user.platform}</span>
                            </div>
                            <div class="content-preview-title">${content.title || '无标题'}</div>
                            <div class="content-preview-meta">
                                <span>❤️ ${content.interactions?.likes || 0}</span>
                                <span>💬 ${content.interactions?.comments || 0}</span>
                                <span style="color: var(--ios-blue);">点击 AI 分析</span>
                            </div>
                        </div>
                    `).join('');
                }).join('')}
            </div>
        </div>
    `;
}

// 带确认的内容分析
async function showContentAnalysisWithConfirm(content, title) {
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 500px;">
            <div class="ai-modal-header">
                <h3>⚠️ 隐私确认</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <p style="margin-bottom: 16px; line-height: 1.6;">
                    您即将使用 AI 分析这条内容，数据将发送到第三方 API。
                </p>
                <div style="background: var(--ios-light-gray); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0; font-size: 13px; color: var(--ios-gray);">
                        内容预览：${decodeURIComponent(title)}...
                    </p>
                </div>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="contentPrivacyAgree" style="width: 18px; height: 18px; accent-color: var(--ios-blue);">
                    <span style="font-size: 14px;">我同意将这条内容发送到第三方 API</span>
                </label>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">取消</button>
                <button class="btn btn-primary" id="confirmContentAIBtn" disabled>确认分析</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const checkbox = modal.querySelector('#contentPrivacyAgree');
    const confirmBtn = modal.querySelector('#confirmContentAIBtn');
    
    checkbox.addEventListener('change', (e) => {
        confirmBtn.disabled = !e.target.checked;
    });
    
    confirmBtn.addEventListener('click', async () => {
        modal.remove();
        await showContentAnalysis(content, title);
    });
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 显示用户画像分析
async function showUserAnalysis() {
    if (!state.crawlResults || state.crawlResults.length === 0) {
        showNotification('暂无采集数据', 'warning');
        return;
    }
    
    const user = state.crawlResults[0];
    const analysis = await analyzeUserProfile(user);
    
    if (!analysis) return;
    
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 700px;">
            <div class="ai-modal-header">
                <h3>👤 用户画像分析 - ${user.nickname}</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <div class="user-profile-analysis">
                    <div class="analysis-section">
                        <h4>📝 画像概述</h4>
                        <p>${analysis.profile_summary}</p>
                    </div>
                    <div class="analysis-section">
                        <h4>🎨 内容风格</h4>
                        <p>${analysis.content_style}</p>
                    </div>
                    <div class="analysis-section">
                        <h4>👥 受众分析</h4>
                        <p>${analysis.audience_analysis}</p>
                    </div>
                    <div class="analysis-section">
                        <h4>✨ 优势</h4>
                        <ul>
                            ${analysis.strengths.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="analysis-section">
                        <h4>📈 改进建议</h4>
                        <ul>
                            ${analysis.improvements.map(i => `<li>${i}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="analysis-section">
                        <h4>🤝 合作价值</h4>
                        <span class="collaboration-badge collaboration-${analysis.collaboration_value}">
                            ${analysis.collaboration_value}
                        </span>
                    </div>
                    <div class="analysis-section">
                        <h4>🏢 适合品牌类型</h4>
                        <div class="brand-tags">
                            ${analysis.suitable_brands.map(b => `<span class="tag tag-primary">${b}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 显示对比分析
async function showCompareAnalysis() {
    if (!state.crawlResults || state.crawlResults.length < 2) {
        showNotification('需要至少 2 个账号才能进行对比分析', 'warning');
        return;
    }
    
    const analysis = await compareUsersAI(state.crawlResults);
    
    if (!analysis) return;
    
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 800px;">
            <div class="ai-modal-header">
                <h3>📈 账号对比分析</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <div class="compare-analysis">
                    <div class="analysis-section">
                        <h4>📝 对比总结</h4>
                        <p>${analysis.comparison_summary}</p>
                    </div>
                    
                    <div class="analysis-section">
                        <h4>🏆 排名</h4>
                        <div class="ranking-list">
                            ${analysis.ranking.map(r => `
                                <div class="ranking-item">
                                    <span class="ranking-number">#${r.rank}</span>
                                    <span class="ranking-name">${r.nickname}</span>
                                    <span class="ranking-reason">${r.reason}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="analysis-section">
                        <h4>🔗 共同点</h4>
                        <p>${analysis.similarities}</p>
                    </div>
                    
                    <div class="analysis-section">
                        <h4>📊 差异点</h4>
                        <p>${analysis.differences}</p>
                    </div>
                    
                    <div class="analysis-section">
                        <h4>💡 推荐建议</h4>
                        <p>${analysis.recommendations}</p>
                    </div>
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 下载报告
function downloadReport() {
    const reportContent = document.querySelector('.ai-report-content')?.innerText;
    if (!reportContent) return;
    
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI分析报告_${new Date().toLocaleDateString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 渲染账号列表
function renderAccountList() {
    const container = elements.accountList;
    if (!container) return;
    
    if (state.accounts.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    const platformIcons = {
        'xiaohongshu': '📕',
        'douyin': '🎵',
        'weibo': '📱',
        'bilibili': '📺',
        'unknown': '❓'
    };
    
    container.innerHTML = `
        <div class="card animate-fade-in">
            <div class="card-header">
                <h3 class="card-title">已导入账号 (${state.accounts.length})</h3>
                <button class="btn btn-secondary" id="clearBtn">清空</button>
            </div>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>平台</th>
                            <th>账号名称</th>
                            <th>链接</th>
                            <th>备注</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.accounts.map((account, index) => `
                            <tr>
                                <td>
                                    <span class="platform-icon">
                                        ${platformIcons[account.platform] || '❓'}
                                    </span>
                                    ${account.platform}
                                </td>
                                <td>${account.nickname || account.name || account['达人昵称'] || '-'}</td>
                                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                                    <a href="${account.url}" target="_blank" style="color: var(--ios-blue);">
                                        ${account.url}
                                    </a>
                                </td>
                                <td>${account.note || account.fans || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // 重新绑定清空按钮事件
    document.getElementById('clearBtn')?.addEventListener('click', clearAccounts);
}

// 清空账号列表
function clearAccounts() {
    state.accounts = [];
    state.crawlResults = null;
    renderAccountList();
    elements.resultContainer.innerHTML = '';
    elements.progressContainer.innerHTML = '';
    showNotification('已清空账号列表', 'info');
}

// 更新UI状态
function updateUIState() {
    if (elements.startBtn) {
        elements.startBtn.disabled = state.isRunning;
        elements.startBtn.innerHTML = state.isRunning 
            ? '<span class="spinner"></span> 采集中...' 
            : '🚀 开始采集';
    }
}

// 加载支持的平台
async function loadPlatforms() {
    try {
        const response = await fetch(`${API_BASE}/api/platforms`);
        const data = await response.json();
        
        // 可以在这里更新平台选择UI
        console.log('支持的平台:', data.platforms);
    } catch (error) {
        console.error('加载平台列表失败:', error);
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;
    
    const colors = {
        success: { bg: '#D4EDDA', color: '#155724', border: '#C3E6CB' },
        error: { bg: '#F8D7DA', color: '#721C24', border: '#F5C6CB' },
        warning: { bg: '#FFF3CD', color: '#856404', border: '#FFEEBA' },
        info: { bg: '#CCE5FF', color: '#004085', border: '#B8DAFF' }
    };
    
    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.color;
    notification.style.border = `1px solid ${color.border}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 显示加载状态
function showLoading(message) {
    // 可以添加全局加载遮罩
    console.log('Loading:', message);
}

// 隐藏加载状态
function hideLoading() {
    console.log('Loading complete');
}

// 渲染主界面
function render() {
    if (!elements.root) return;
    
    elements.root.innerHTML = `
        <div class="app-container">
            <header class="app-header">
                <h1 class="app-title">达人账号内容分析工具</h1>
                <p class="app-subtitle">模拟真实用户行为，安全采集社交媒体数据</p>
                ${state.aiEnabled ? '<span class="ai-badge">🤖 AI 分析已启用</span>' : ''}
            </header>
            
            <!-- 文件上传区域 -->
            <div class="card">
                <div class="upload-zone" id="uploadZone">
                    <div class="upload-icon">📁</div>
                    <div class="upload-text">点击或拖放文件到此处</div>
                    <div class="upload-hint">支持 Excel (.xlsx, .xls) 或 CSV 格式</div>
                </div>
                <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display: none;">
            </div>
            
            <!-- 账号列表 -->
            <div id="accountList"></div>
            
            <!-- 预登录模块 -->
            <div class="card animate-fade-in" style="border: 2px solid var(--ios-orange);">
                <div class="card-header" style="background: rgba(255, 149, 0, 0.05);">
                    <h3 class="card-title" style="color: var(--ios-orange);">🔐 蒲公英预登录</h3>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 16px; color: var(--ios-gray); font-size: 14px;">
                        采集蒲公英账号前，请先完成预登录。步骤：1)点击开始预登录 2)在弹出的浏览器中登录 3)点击确认已登录
                    </p>
                    <div id="preloginStatus" style="margin-bottom: 16px; font-size: 13px; color: var(--ios-gray);">
                        点击按钮检查登录状态...
                    </div>
                    <!-- 初始按钮组 -->
                    <div id="preloginInitialBtns" style="display: flex; gap: 12px;">
                        <button class="btn btn-secondary" id="checkCookieBtn" style="flex: 1;">
                            🔍 检查Cookie
                        </button>
                        <button class="btn btn-primary" id="preloginBtn" style="flex: 1; background: var(--ios-orange);">
                            🔐 开始预登录
                        </button>
                    </div>
                    <!-- 登录中按钮组（隐藏） -->
                    <div id="preloginActiveBtns" style="display: none; flex-direction: column; gap: 12px;">
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn-primary" id="confirmLoginBtn" style="flex: 1; background: var(--ios-green);">
                                ✓ 确认已登录
                            </button>
                            <button class="btn btn-secondary" id="cancelLoginBtn" style="flex: 1;">
                                ✗ 取消
                            </button>
                        </div>
                        <p style="font-size: 12px; color: var(--ios-gray); text-align: center;">
                            请在浏览器中完成登录，然后点击"确认已登录"
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- 配置选项 -->
            ${state.accounts.length > 0 ? `
                <div class="card animate-fade-in">
                    <div class="card-header">
                        <h3 class="card-title">采集设置</h3>
                    </div>
                    <div class="form-group">
                        <label class="form-label">每个账号采集内容数</label>
                        <select class="form-select" id="maxContentsSelect">
                            <option value="5">5 条</option>
                            <option value="10" selected>10 条</option>
                            <option value="20">20 条</option>
                            <option value="50">50 条</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        <button class="btn btn-primary" id="startBtn" style="flex: 1;">
                            🚀 开始采集
                        </button>
                    </div>
                </div>
            ` : ''}
            
            <!-- 进度显示 -->
            <div id="progressContainer"></div>
            
            <!-- 结果显示 -->
            <div id="resultContainer"></div>
            
            <!-- AI 分析本地文件模块 -->
            ${state.aiEnabled ? `
                <div class="card" style="margin-top: 30px; border: 2px solid var(--ios-blue);">
                    <div class="card-header" style="background: rgba(0, 122, 255, 0.05);">
                        <h3 class="card-title" style="color: var(--ios-blue);">🤖 AI 分析本地文件</h3>
                    </div>
                    <div style="padding: 20px;">
                        <p style="margin-bottom: 16px; color: var(--ios-gray); font-size: 14px;">
                            选择已保存在本地的 JSON 数据文件，使用 AI 进行深度分析。
                            <span style="color: var(--ios-orange);">数据将发送到第三方 API。</span>
                        </p>
                        
                        <div id="localFilesList" style="margin-bottom: 16px;">
                            <p style="color: var(--ios-gray); font-size: 13px;">正在加载本地文件列表...</p>
                        </div>
                        
                        <button class="btn btn-primary" onclick="loadLocalFilesForAI()" style="width: 100%;">
                            🔄 刷新文件列表
                        </button>
                    </div>
                </div>
            ` : ''}
            
            <!-- 使用说明 -->
            <div class="card" style="margin-top: 40px;">
                <div class="card-header">
                    <h3 class="card-title">📖 使用说明</h3>
                </div>
                <div style="color: var(--ios-gray); font-size: 14px; line-height: 1.8;">
                    <p><strong>1. 准备账号列表</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        创建一个 Excel 文件，包含以下列：平台、账号名称、主页链接、备注（可选）
                    </p>
                    
                    <p><strong>2. 上传文件</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        点击上传区域或拖放文件到此处，支持 .xlsx、.xls、.csv 格式
                    </p>
                    
                    <p><strong>3. 开始采集</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        设置采集参数，点击"开始采集"按钮。系统将自动模拟真实用户行为采集数据
                    </p>
                    
                    <p><strong>4. 数据保存</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        采集完成后，数据会自动保存到本地 output 目录（JSON 和 Excel 格式）
                    </p>
                    
                    <p><strong>5. AI 分析（可选）</strong></p>
                    <p style="margin-left: 20px; margin-bottom: 12px;">
                        使用"AI 分析本地文件"功能，选择已保存的 JSON 文件进行智能分析
                    </p>
                    
                    <p><strong>6. 下载报告</strong></p>
                    <p style="margin-left: 20px;">
                        可以下载 Excel 报告、JSON 数据或 AI 生成的 Markdown 分析报告
                    </p>
                </div>
            </div>
        </div>
    `;
    
    // 重新缓存元素
    cacheElements();
    bindEvents();
    
    // 绑定配置选择事件
    document.getElementById('maxContentsSelect')?.addEventListener('change', (e) => {
        state.config.maxContents = parseInt(e.target.value);
    });
}

// 加载本地文件列表（用于 AI 分析）
async function loadLocalFilesForAI() {
    const container = document.getElementById('localFilesList');
    if (!container) return;
    
    container.innerHTML = '<p style="color: var(--ios-gray); font-size: 13px;">正在加载...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/ai/list-local-files`);
        const data = await response.json();
        
        if (data.success && data.files && data.files.length > 0) {
            container.innerHTML = `
                <div class="local-files-grid" style="display: grid; gap: 12px;">
                    ${data.files.map(file => `
                        <div class="local-file-item" style="background: var(--ios-light-gray); padding: 16px; border-radius: 12px; border: 1px solid var(--ios-border);">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                <div>
                                    <p style="font-weight: 600; margin: 0 0 4px 0; font-size: 14px;">${file.filename}</p>
                                    <p style="margin: 0; font-size: 12px; color: var(--ios-gray);">
                                        创建时间: ${file.created} | 大小: ${(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button class="btn btn-primary" style="flex: 1; font-size: 13px; padding: 8px 12px;" 
                                        onclick="analyzeLocalFileWithConfirm('${file.filename}', 'report')">
                                    📊 整体报告
                                </button>
                                <button class="btn btn-secondary" style="flex: 1; font-size: 13px; padding: 8px 12px;" 
                                        onclick="analyzeLocalFileWithConfirm('${file.filename}', 'user')">
                                    👤 用户画像
                                </button>
                                <button class="btn btn-secondary" style="flex: 1; font-size: 13px; padding: 8px 12px;" 
                                        onclick="analyzeLocalFileWithConfirm('${file.filename}', 'compare')">
                                    📈 对比分析
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 30px; color: var(--ios-gray);">
                    <p style="margin: 0 0 8px 0;">暂无本地数据文件</p>
                    <p style="margin: 0; font-size: 13px;">请先进行数据采集，数据将自动保存到本地</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--ios-red);">
                <p style="margin: 0;">加载失败: ${error.message}</p>
            </div>
        `;
    }
}

// 带确认的本地文件分析
async function analyzeLocalFileWithConfirm(filename, type) {
    // 显示隐私确认对话框
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 500px;">
            <div class="ai-modal-header">
                <h3>⚠️ 隐私确认</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                <p style="margin-bottom: 16px; line-height: 1.6;">
                    您即将使用 AI 分析本地文件：<strong>${filename}</strong>
                </p>
                
                <div style="background: #FFF3CD; border: 1px solid #FFEEBA; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: #856404; font-weight: 500;">
                        ⚠️ 数据将发送到第三方 API
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #856404; line-height: 1.5;">
                        本地文件 → 本应用服务器 → comfly.chat API (第三方)
                    </p>
                </div>
                
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="filePrivacyAgree" style="width: 18px; height: 18px; accent-color: var(--ios-blue);">
                    <span style="font-size: 14px;">我理解并同意将数据发送到第三方 API 进行分析</span>
                </label>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">取消</button>
                <button class="btn btn-primary" id="confirmFileAIBtn" disabled>确认分析</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const checkbox = modal.querySelector('#filePrivacyAgree');
    const confirmBtn = modal.querySelector('#confirmFileAIBtn');
    
    checkbox.addEventListener('change', (e) => {
        confirmBtn.disabled = !e.target.checked;
    });
    
    confirmBtn.addEventListener('click', async () => {
        modal.remove();
        await executeLocalFileAnalysis(filename, type);
    });
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 执行本地文件 AI 分析
async function executeLocalFileAnalysis(filename, type) {
    showLoading('AI 分析中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/ai/analyze-local-file`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: filename,
                type: type
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            if (type === 'report') {
                showAIReportModal(data.report, filename);
            } else {
                showAIAnalysisResultModal(data.data, type, filename);
            }
        } else {
            showNotification('分析失败: ' + (data.error || '未知错误'), 'error');
        }
    } catch (error) {
        showNotification('分析请求失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 显示 AI 分析报告弹窗
function showAIReportModal(report, filename) {
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 800px; max-height: 90vh;">
            <div class="ai-modal-header">
                <h3>📊 AI 分析报告 - ${filename}</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body" style="max-height: 60vh; overflow-y: auto;">
                <div class="markdown-content" style="line-height: 1.8; color: var(--ios-black);">
                    ${report.replace(/\n/g, '<br>').replace(/#{1,6} (.+)/g, '<h3 style="color: var(--ios-blue); margin-top: 20px;">$1</h3>')}
                </div>
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
                <button class="btn btn-primary" onclick="downloadAIReport('${filename}', \`${report.replace(/`/g, '\\`')}\`)">
                    💾 下载报告
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 显示 AI 分析结果弹窗
function showAIAnalysisResultModal(data, type, filename) {
    let title = '';
    let content = '';
    
    if (type === 'user') {
        title = '👤 用户画像分析';
        content = `
            <div class="analysis-result">
                <div class="analysis-item">
                    <span class="analysis-label">📝 内容风格</span>
                    <span class="analysis-value">${data.content_style || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">👥 目标受众</span>
                    <span class="analysis-value">${data.target_audience || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">💪 核心优势</span>
                    <span class="analysis-value">${data.strengths || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">📈 改进建议</span>
                    <span class="analysis-value">${data.improvement_suggestions || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">💎 合作价值</span>
                    <span class="analysis-value">${data.collaboration_value || 'N/A'}</span>
                </div>
            </div>
        `;
    } else if (type === 'compare') {
        title = '📈 对比分析结果';
        content = `
            <div class="analysis-result">
                <div class="analysis-item">
                    <span class="analysis-label">🏆 排名</span>
                    <span class="analysis-value">${data.ranking || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">🤝 共同点</span>
                    <span class="analysis-value">${data.common_points || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">⚡ 差异点</span>
                    <span class="analysis-value">${data.differences || 'N/A'}</span>
                </div>
                <div class="analysis-item">
                    <span class="analysis-label">💡 推荐建议</span>
                    <span class="analysis-value">${data.recommendations || 'N/A'}</span>
                </div>
            </div>
        `;
    }
    
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    modal.innerHTML = `
        <div class="ai-modal-backdrop"></div>
        <div class="ai-modal-content" style="max-width: 600px;">
            <div class="ai-modal-header">
                <h3>${title} - ${filename}</h3>
                <button class="ai-modal-close">&times;</button>
            </div>
            <div class="ai-modal-body">
                ${content}
            </div>
            <div class="ai-modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.ai-modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.ai-modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.ai-modal-backdrop').addEventListener('click', () => {
        modal.remove();
    });
}

// 下载 AI 报告
function downloadAIReport(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI分析报告_${filename.replace('.json', '')}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('报告已下载', 'success');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
