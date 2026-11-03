import { getLocale } from "next-intl/server";
import { Accordion,AccordionContent,AccordionItem,AccordionTrigger } from "@/components/ui/accordion";
import { CREDITS_CONFIG,getAvailableModels,getSubscriptionProducts } from "@/config/credits";
import { LEGAL_CONFIG } from "@/config/legal";
import { localizedHref } from "@/lib/du-home";

export async function FAQSection() {
  const lang=await getLocale();
  const zh=lang==="zh";
  const w=(cn:string,en:string)=>zh?cn:en;
  const gift=CREDITS_CONFIG.registerGift;
  const models=getAvailableModels({mode:"text-to-video"}).map(m=>m.name).join(zh?"、":", ");
  const commercial=[...new Set(getSubscriptionProducts().filter(p=>p.features?.includes("commercial_use")).map(p=>p.name.replace(/\s+(Monthly|Yearly)$/i,"")))].join(", ");
  const items=[
    [w("我可以从哪里开始？","How do I start a video?"),w("在上方输入镜头描述、选择模型，再打开工作台。你可以在那里调整设置并确认生成。","Describe a shot above, choose a model, and open the studio. Adjust the settings there before confirming generation.")],
    [w("注册有免费额度吗？","Are there starter credits?"),gift.enabled?w(`新账户可获 ${gift.amount} 积分，有效期 ${gift.expireDays} 天。一次生成可能需要更多积分，请先查看用量。`,`New accounts receive ${gift.amount} starter credits, valid for ${gift.expireDays} days. A generation may cost more than the starter balance; check the estimate before confirming.`):w("当前未配置注册赠送额度。","No signup credit grant is configured.")],
    [w("必须登录才能生成吗？","Do I need an account to generate?"),w("可以先浏览样片、写好提示词。提交生成需要登录，并有足够的积分。","You can browse films and draft a prompt first. Submitting a generation requires signing in and having enough credits.")],
    [w("目前能用哪些文生视频模型？","Which text-to-video models can I use?"),models],
    [w("怎样让一张图片动起来？","How do I animate a still?"),w("选择图生视频、描述应该如何运动，再到工作台上传有权使用的起始图。","Select Image → Video, describe the motion, and upload a starting image you have permission to use in the studio.")],
    [w("每次生成要多少积分？","What determines the credit cost?"),w("模型、时长和画质决定费用。首页按钮显示所选模型默认镜头的估算；在工作台修改设置后，按最终设置计费。","The model, duration and quality determine the cost. The prompt button estimates the default shot; changing studio settings can change the final amount.")],
    [w("导出的视频有水印吗？","Will my export have a watermark?"),w("本站没有对所有模型或套餐作统一的无水印承诺。请在交付前检查实际导出的片段。","There is no site-wide watermark-free guarantee for every model or plan. Check the actual export before delivering your film.")],
    [w("可以商用吗？","Can I use my film commercially?"),commercial?w(`当前套餐中，${commercial} 列有商用权益。请核对你购买的套餐，并确认素材与输出不侵犯第三方权利。`,`The current plans listing commercial use are ${commercial}. Check your purchased plan and ensure you have the necessary rights to your inputs and output.`):w("查看所选套餐的商用条款，并确认素材权利。","Check the commercial-use terms of your chosen plan and your rights to the source material.")],
    [w("未使用的积分包可以退款吗？","Can I request a refund on an unused credit pack?"),w(`按照退款政策，购买积分包后 ${LEGAL_CONFIG.refundWindowDays} 天内，如该包积分完全未使用，可以申请退款。订阅适用单独条款。`,`The refund policy allows a request within ${LEGAL_CONFIG.refundWindowDays} days of buying a credit pack if none of its credits have been used. Separate terms apply to subscriptions.`)],
    [w("这些说明最后何时更新？","When were these notes last reviewed?"),w("本页说明于 2026-11-02 核对了已配置的模型、积分及退款条款。","These notes were checked against the configured models, credits and refund terms on November 2, 2026.")],
  ];
  const schema={"@context":"https://schema.org","@type":"FAQPage",mainEntity:items.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))};
  return <section className="du-faq du-frame" aria-labelledby="du-faq-heading">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/>
    <div><h2 id="du-faq-heading">{w("常见问题","Frequently Asked Questions")}</h2><p>{w("从第一帧到最终导出。","From your first frame to your final export.")}</p>
    <a href={localizedHref(lang,"/pricing")}>{w("查看套餐和积分","See plans and credits")} ↗</a></div>
    <Accordion type="single" collapsible>{items.map(([q,a],i)=><AccordionItem key={q} value={"q"+i}>
      <AccordionTrigger>{q}</AccordionTrigger><AccordionContent>{a}{i===8 && <a href={localizedHref(lang,"/refund-policy")}>{w("退款政策","Refund policy")} ↗</a>}</AccordionContent>
    </AccordionItem>)}</Accordion>
  </section>;
}
