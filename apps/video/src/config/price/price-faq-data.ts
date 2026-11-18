interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

/**
 * 定价页面 FAQ 数据
 *
 * 基于 PRICING_REFERENCE.md 文档更新
 */
export const priceFaqDataMap: Record<string, FAQItem[]> = {
  zh: [
    {
      id: "item-1",
      question: "积分是如何工作的？",
      answer:
        "每次生成视频时会消耗积分。不同模型和不同分辨率消耗的积分不同。例如，Veo 3.1 生成一个视频消耗 10 积分。您可以随时在账户中查看积分余额。",
    },
    {
      id: "item-2",
      question: "Basic 计划的费用是多少？",
      answer:
        "Basic 月付计划每月 12 美元，提供 1,000 积分。年付计划 132 美元，提供 12,000 积分，相当于省了 1 个月的费用。每条视频消耗的积分因模型和规格而异，生成前会显示。",
    },
    {
      id: "item-3",
      question: "Pro 计划包含哪些功能？",
      answer:
        "Pro 计划每月提供 3,000 积分，每月 29 美元。年付 319 美元，提供 36,000 积分。Pro 计划包含商业使用权，是最受欢迎的选择。",
    },
    {
      id: "item-4",
      question: "我可以一次性购买积分吗？",
      answer:
        "是的！我们提供一次性积分包：Starter Pack（650 积分，10 美元）、Standard Pack（2,100 积分，30 美元）和 Pro Pack（7,500 积分，100 美元）。积分包有效期为 1 年。",
    },
    {
      id: "item-5",
      question: "订阅和一次性购买有什么区别？",
      answer:
        "订阅每月自动为您充值积分，月付积分有效期为 30 天。一次性购买积分包只需支付一次，积分有效期为 1 年。订阅用户享受更优惠的单价，年付订阅可省 17%。",
    },
    {
      id: "item-6",
      question: "我可以随时取消订阅吗？",
      answer:
        "是的，您可以随时取消订阅。取消后，您将在当前计费周期结束后停止续费，已经充值的积分不会受到影响。",
    },
  ],
  en: [
    {
      id: "item-1",
      question: "How do credits work?",
      answer:
        "Each video generation consumes credits. Different models and resolutions consume different amounts. For example, Veo 3.1 consumes 10 credits per video. You can check your credit balance anytime in your account.",
    },
    {
      id: "item-2",
      question: "How much does the Basic plan cost?",
      answer:
        "The Basic monthly plan is $12/month with 1,000 credits. The yearly plan is $132 with 12,000 credits, saving you 1 month of payments. Credits per video depend on the model and settings, and are shown before you generate.",
    },
    {
      id: "item-3",
      question: "What's included in the Pro plan?",
      answer:
        "The Pro plan provides 3,000 credits per month at $29/month. The yearly plan is $319 with 36,000 credits. The Pro plan includes commercial license. It's our most popular choice.",
    },
    {
      id: "item-4",
      question: "Can I purchase credits one-time?",
      answer:
        "Yes! We offer one-time credit packages: Starter Pack (650 credits, $10), Standard Pack (2,100 credits, $30), and Pro Pack (7,500 credits, $100). Credit packages are valid for 1 year.",
    },
    {
      id: "item-5",
      question: "What's the difference between subscription and one-time purchase?",
      answer:
        "Subscriptions automatically recharge your credits monthly. Monthly subscription credits are valid for 30 days. One-time credit packages require a single payment and credits are valid for 1 year. Subscribers enjoy better per-credit rates, and yearly plans save 17%.",
    },
    {
      id: "item-6",
      question: "Can I cancel my subscription anytime?",
      answer:
        "Yes, you can cancel your subscription anytime. After cancellation, you'll stop being charged at the end of your current billing period, and your existing credits will not be affected.",
    },
  ],
  ja: [
    {
      id: "item-1",
      question: "クレジットはどのように機能しますか？",
      answer:
        "動画を生成するたびにクレジットが消費されます。モデルや解像度によって消費量が異なります。例えば、Veo 3.1 は動画あたり 10 クレジットを消費します。アカウントでいつでもクレジット残高を確認できます。",
    },
    {
      id: "item-2",
      question: "Basic プランの費用はいくらですか？",
      answer:
        "Basic 月額プランは月額 12 ドルで 1,000 クレジット。年額プランは 132 ドルで 12,000 クレジット、1 ヶ月分の支払いを節約できます。動画 1 本あたりのクレジットはモデルと設定によって異なり、生成前に表示されます。",
    },
    {
      id: "item-3",
      question: "Pro プランには何が含まれていますか？",
      answer:
        "Pro プランは月額 29 ドルで 3,000 クレジット。年額プランは 319 ドルで 36,000 クレジット。Pro プランには商用利用権が含まれ、最も人気のある選択肢です。",
    },
    {
      id: "item-4",
      question: "クレジットを一回限りの購入でできますか？",
      answer:
        "はい！Starter Pack（650 クレジット、10 ドル）、Standard Pack（2,100 クレジット、30 ドル）、Pro Pack（7,500 クレジット、100 ドル）の一回限りのクレジットパッケージをご用意しています。有効期間は 1 年です。",
    },
    {
      id: "item-5",
      question: "サブスクリプションと一回限りの購入の違いは何ですか？",
      answer:
        "サブスクリプションは毎月自動的にクレジットをチャージします。月額サブスクリプションのクレジットは 30 日間有効です。一回限りのクレジットパッケージは一度の支払いで、クレジットは 1 年間有効です。サブスクライバーはよりお得なレートを享受でき、年額プランは 17% 節約できます。",
    },
    {
      id: "item-6",
      question: "サブスクリプションをいつでもキャンセルできますか？",
      answer:
        "はい、いつでもサブスクリプションをキャンセルできます。キャンセル後、現在の請求期間の終了時に課金が停止され、既存のクレジットには影響しません。",
    },
  ],
  ko: [
    {
      id: "item-1",
      question: "크레딧은 어떻게 작동하나요?",
      answer:
        "비디오를 생성할 때마다 크레딧이 소비됩니다. 모델과 해상도에 따라 소비량이 다릅니다. 예를 들어, Veo 3.1은 비디오당 10 크레딧을 소비합니다. 계정에서 언제든지 크레딧 잔액을 확인할 수 있습니다.",
    },
    {
      id: "item-2",
      question: "Basic 플랜의 비용은 얼마인가요?",
      answer:
        "Basic 월간 플랜은 월 $12에 1,000 크레딧을 제공합니다. 연간 플랜은 $132에 12,000 크레딧을 제공하며 1개월치 요금을 절약할 수 있습니다. 비디오당 크레딧은 모델과 설정에 따라 다르며 생성 전에 표시됩니다.",
    },
    {
      id: "item-3",
      question: "Pro 플랜에는 무엇이 포함되어 있나요?",
      answer:
        "Pro 플랜은 월 $29에 월 3,000 크레딧을 제공합니다. 연간 플랜은 $319에 36,000 크레딧을 제공합니다. Pro 플랜에는 상업용 라이선스가 포함되어 있으며 가장 인기 있는 선택입니다.",
    },
    {
      id: "item-4",
      question: "일회성 크레딧을 구매할 수 있나요?",
      answer:
        "네! Starter Pack(650 크레딧, $10), Standard Pack(2,100 크레딧, $30), Pro Pack(7,500 크레딧, $100)의 일회성 크레딧 패키지를 제공합니다. 크레딧 패키지는 1년 동안 유효합니다.",
    },
    {
      id: "item-5",
      question: "구독과 일회성 구매의 차이점은 무엇인가요?",
      answer:
        "구독은 매월 자동으로 크레딧을 충전합니다. 월간 구독 크레딧은 30일 동안 유효합니다. 일회성 크레딧 패키지는 한 번의 결제로 되며 크레딧은 1년 동안 유효합니다. 구독자는 더 저렴한 크레딧 단가를 누릴 수 있으며 연간 플랜은 17% 절약됩니다.",
    },
    {
      id: "item-6",
      question: "언제든지 구독을 취소할 수 있나요?",
      answer:
        "네, 언제든지 구독을 취소할 수 있습니다. 취소 후 현재 청구 기간이 끝날 때 요금 청구가 중지되며 기존 크레딧에는 영향을 받지 않습니다.",
    },
  ],
};
