/**
 * 信用系统模块合并文件
 * 
 * 说明：信用系统仅存在于 mkfast-app 中
 */

// 导出信用系统类型和计划

// 导出信用系统计划
export const CreditPlan = {
  packages: [
    { name: 'Basic', credits: 100, price: 9.99 },
    { name: 'Pro', credits: 500, price: 49.99 },
    { name: 'Enterprise', credits: 1000, price: 99.99 },
  ],
  redemption: {
    description: '用户可使用信用点数兑换图像生成服务',
    note: '兑换逻辑需在应用层实现',
  },
};
