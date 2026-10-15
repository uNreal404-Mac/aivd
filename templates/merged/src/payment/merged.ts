/**
 * 支付模块合并文件
 * 
 * 说明：使用 Stripe、Creem、Waffo 等提供商
 * 注意：应用层可能在支付成功后挂钩信用系统
 */

// 导出支付提供商

// 导出支付计划
export const PaymentPlan = {
  providers: ['Stripe', 'Creem', 'Waffo'],
  note: '应用层可能在支付成功后挂钩信用系统',
};
