import overview from './overview.md?raw'
import registerLogin from './register-login.md?raw'
import redeemCode from './redeem-code.md?raw'
import subscriptionLink from './subscription-link.md?raw'
import clashVerge from './clash-verge.md?raw'
import surge from './surge.md?raw'
import clashMi from './clash-mi.md?raw'
import clashParty from './clash-party.md?raw'
import clients from './clients.md?raw'
import faq from './faq.md?raw'
import contact from './contact.md?raw'

export type HelpArticle = {
  id: string
  title: string
  description?: string
  content: string
}

export const helpArticles: HelpArticle[] = [
  {
    id: 'overview',
    title: '系统介绍',
    description: '了解系统用途和整体使用流程',
    content: overview,
  },
  {
    id: 'register-login',
    title: '注册与登录',
    description: '注册账号并登录控制台',
    content: registerLogin,
  },
  {
    id: 'redeem-code',
    title: '授权码兑换',
    description: '使用授权码激活或续期账号',
    content: redeemCode,
  },
  {
    id: 'subscription-link',
    title: '获取订阅链接',
    description: '选择客户端模板并复制订阅链接',
    content: subscriptionLink,
  },
  {
    id: 'clash-verge',
    title: 'Clash Verge 使用说明',
    description: '导入订阅、选择节点并开启代理',
    content: clashVerge,
  },
  {
    id: 'clash-party',
    title: 'Clash Party 使用说明',
    description: '导入订阅、选择节点、更新配置',
    content: clashParty,
  },
  {
    id: 'surge',
    title: 'Surge 使用说明',
    description: '导入订阅、选择模块并开启代理',
    content: surge,
  },
  {
    id: 'clash-mi',
    title: 'Clash Mi 使用说明',
    description: '导入订阅、选择节点并开启代理',
    content: clashMi,
  },
  {
    id: 'clients',
    title: '客户端推荐',
    description: '不同设备的客户端选择建议',
    content: clients,
  },
  {
    id: 'faq',
    title: '常见问题',
    description: '常见故障和处理方法',
    content: faq,
  },
  {
    id: 'contact',
    title: '售后联系',
    description: '售后联系方式和反馈信息格式',
    content: contact,
  },
]
