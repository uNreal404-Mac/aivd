/**
 * 身份验证模块合并文件
 * 
 * 主要来源：mkfast-template/*
 * 覆盖内容：mkfast-app 中的 Google 扩展令牌处理等
 */

// 导出合并计划
export const MergedAuthPlan = {
  primary: 'mkfast-template', // 主要来源
  overlay: 'mkfast-app', // 覆盖内容
  notes: [
    'Google 扩展令牌处理逻辑来自 mkfast-app',
    '其他身份验证逻辑基于 mkfast-template',
  ],
};

// 重新导出主要模块

// 重新导出覆盖模块
