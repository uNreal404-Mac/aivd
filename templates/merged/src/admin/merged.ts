/**
 * 管理后台模块合并文件
 * 
 * 说明：mkfast-template 包含用户管理，mkfast-app 添加了提示、任务、兑换等功能
 */

// 导出管理模块计划
export const AdminModulePlan = {
  routes: [
    'users', // 用户管理（来自 mkfast-template）
    'prompts', // 提示管理（来自 mkfast-app）
    'tasks', // 任务管理（来自 mkfast-app）
    'redemptions', // 兑换管理（来自 mkfast-app）
  ],
  note: '管理后台功能由 mkfast-template 和 mkfast-app 共同实现',
};
