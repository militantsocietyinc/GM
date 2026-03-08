// Firecrawl 实时新闻抓取服务
// 用于获取五厂商最新新闻的真实可访问链接

const FIRECRAWL_API_KEY = 'fc-6e52871e239a4ca6976380df246c7e31';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/search';

// 五厂商搜索关键词
const VENDOR_QUERIES = {
  '远光软件': [
    '远光软件 涨停 算电协同 site:eastmoney.com',
    '远光软件 中标 site:ccgp.gov.cn',
    '远光软件 官网 site:ygsoft.com',
    '远光软件 业绩 site:10jqka.com.cn'
  ],
  '用友网络': [
    '用友网络 中标 site:ccgp.gov.cn',
    '用友网络 BIP site:yonyou.com',
    '用友网络 云业务 site:10jqka.com.cn'
  ],
  '金蝶国际': [
    '金蝶国际 业绩 site:kingdee.com',
    '金蝶 云·苍穹 site:kingdee.com',
    '金蝶国际 中标 site:ccgp.gov.cn'
  ],
  '浪潮软件': [
    '浪潮软件 政务云 site:inspur.com',
    '浪潮软件 中标 site:ccgp.gov.cn',
    '浪潮软件 业绩 site:10jqka.com.cn'
  ],
  '中兴新云': [
    '中兴新云 财务云 site:zte.com.cn',
    '中兴新云 中标 site:ccgp.gov.cn'
  ]
};

/**
 * 使用 Firecrawl 搜索新闻
 * @param {string} query - 搜索关键词
 * @param {number} limit - 返回结果数量
 * @returns {Promise<Array>} 新闻列表
 */
async function searchNews(query, limit = 5) {
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        limit: limit
      })
    });

    if (!response.ok) {
      throw new Error(`Firecrawl API 错误：${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Firecrawl 搜索失败:', error);
    return [];
  }
}

/**
 * 抓取单个厂商的最新新闻
 * @param {string} vendor - 厂商名称
 * @returns {Promise<Array>} 新闻列表
 */
async function fetchVendorNews(vendor) {
  const queries = VENDOR_QUERIES[vendor] || [];
  const allNews = [];

  for (const query of queries) {
    const results = await searchNews(query, 3);
    allNews.push(...results);
  }

  // 去重并格式化
  const uniqueNews = [];
  const seenUrls = new Set();

  for (const item of allNews) {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      uniqueNews.push({
        company: vendor,
        title: item.title || '无标题',
        source: extractSource(item.url),
        date: extractDate(item.url) || new Date().toISOString().split('T')[0],
        sentiment: 'positive', // 默认正面
        dimension: categorizeNews(item.title, item.description),
        url: item.url,
        aiSummary: generateAISummary(item.title, item.description, vendor),
        summary: item.description || ''
      });
    }
  }

  return uniqueNews.slice(0, 10); // 每个厂商最多 10 条
}

/**
 * 从 URL 提取来源名称
 */
function extractSource(url) {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;

  if (hostname.includes('eastmoney')) return '东方财富';
  if (hostname.includes('10jqka')) return '同花顺';
  if (hostname.includes('ccgp')) return '中国政府采购网';
  if (hostname.includes('ygsoft')) return '远光软件官网';
  if (hostname.includes('yonyou')) return '用友网络官网';
  if (hostname.includes('kingdee')) return '金蝶国际官网';
  if (hostname.includes('inspur')) return '浪潮软件官网';
  if (hostname.includes('zte')) return '中兴通讯官网';
  if (hostname.includes('stcn')) return '证券时报';
  if (hostname.includes('chinanews')) return '中国新闻网';

  return hostname.replace('www.', '');
}

/**
 * 从 URL 或内容中提取日期
 */
function extractDate(url) {
  // 尝试从 URL 中提取日期（如 /20260307/ 格式）
  const dateMatch = url.match(/(\d{4})(\d{2})(\d{2})/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * 根据标题和内容分类新闻维度
 */
function categorizeNews(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();

  if (text.includes('中标') || text.includes('采购') || text.includes('合同')) return 'tender';
  if (text.includes('业绩') || text.includes('财报') || text.includes('利润') || text.includes('收入')) return 'finance';
  if (text.includes('发布') || text.includes('产品') || text.includes('升级')) return 'product';
  if (text.includes('合作') || text.includes('战略') || text.includes('签约')) return 'partner';
  if (text.includes('政策') || text.includes('监管') || text.includes('报告')) return 'regulation';
  if (text.includes('云') || text.includes('数字化') || text.includes('智能')) return 'digital';
  if (text.includes('央企') || text.includes('国企') || text.includes('电网')) return 'state-owned';

  return 'market';
}

/**
 * 生成 AI 摘要
 */
function generateAISummary(title, description, vendor) {
  const desc = description || title;
  const emojis = {
    '远光软件': '🔵',
    '用友网络': '🟢',
    '金蝶国际': '🟣',
    '浪潮软件': '🟠',
    '中兴新云': '⚪'
  };

  const emoji = emojis[vendor] || '📰';
  
  // 简单摘要生成（实际应该调用 LLM）
  return `${emoji} ${vendor}：${desc.substring(0, 150)}${desc.length > 150 ? '...' : ''}`;
}

/**
 * 抓取所有厂商的最新新闻
 * @returns {Promise<Object>} 包含所有厂商新闻的对象
 */
async function fetchAllVendorNews() {
  const vendors = Object.keys(VENDOR_QUERIES);
  const results = {};

  for (const vendor of vendors) {
    console.log(`正在抓取 ${vendor} 的新闻...`);
    results[vendor] = await fetchVendorNews(vendor);
  }

  return results;
}

// 导出函数（用于前端调用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    searchNews,
    fetchVendorNews,
    fetchAllVendorNews
  };
}

// 如果在浏览器中运行，暴露到全局作用域
if (typeof window !== 'undefined') {
  window.FirecrawlService = {
    searchNews,
    fetchVendorNews,
    fetchAllVendorNews
  };
}
