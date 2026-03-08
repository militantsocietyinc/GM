// Firecrawl 新闻抓取 API 端点
// 供前端页面调用，获取实时新闻数据

import { fetchAllVendorNews, fetchVendorNews } from '../services/firecrawl-service.js';

/**
 * GET /api/news/vendors
 * 获取所有厂商的最新新闻
 */
export async function getAllVendorNews(req, res) {
  try {
    console.log('开始抓取所有厂商新闻...');
    const news = await fetchAllVendorNews();
    
    res.json({
      success: true,
      data: news,
      timestamp: new Date().toISOString(),
      message: '新闻数据已实时更新'
    });
  } catch (error) {
    console.error('获取厂商新闻失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '获取新闻失败，请稍后重试'
    });
  }
}

/**
 * GET /api/news/vendor/:vendorName
 * 获取单个厂商的最新新闻
 */
export async function getVendorNews(req, res) {
  const { vendorName } = req.params;
  
  try {
    console.log(`开始抓取 ${vendorName} 的新闻...`);
    const news = await fetchVendorNews(vendorName);
    
    res.json({
      success: true,
      data: news,
      timestamp: new Date().toISOString(),
      message: `${vendorName} 新闻数据已实时更新`
    });
  } catch (error) {
    console.error(`获取 ${vendorName} 新闻失败:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: `获取 ${vendorName} 新闻失败，请稍后重试`
    });
  }
}

/**
 * GET /api/news/refresh
 * 强制刷新所有新闻数据
 */
export async function refreshAllNews(req, res) {
  try {
    console.log('强制刷新所有新闻数据...');
    const news = await fetchAllVendorNews();
    
    // 这里可以添加缓存逻辑，将数据保存到数据库或缓存
    
    res.json({
      success: true,
      data: news,
      timestamp: new Date().toISOString(),
      message: '所有新闻数据已强制刷新'
    });
  } catch (error) {
    console.error('刷新新闻数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '刷新新闻数据失败，请稍后重试'
    });
  }
}

// 导出路由
export const newsRoutes = {
  getAllVendorNews,
  getVendorNews,
  refreshAllNews
};
