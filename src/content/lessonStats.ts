/* 講座ごとの、単元の数と学科に要る時間。

   **手で書かないこと**（npm run build:stats が書き出す）。

   マイページと受講管理が、73講座ぶんの教材（15MB）を毎回読んで
   数えていたのをやめるために置いた（2026-09-10）。
   欲しいのは数字2つだけなので、先に数えておく。

   教材を直したら、書き出し直すこと。ずれていたら
   tests/lesson-stats.mts が止める。 */

export type LessonRow = { id: string; title: string; legal_min: number };
export type LessonStat = { lessons: number; requiredSec: number; list: LessonRow[] };

export const LESSON_STATS: Record<string, LessonStat> = {
  "ashiba": {
    "lessons": 13,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "足場の種類、材料、構造及び組立図",
        "legal_min": 50
      },
      {
        "id": "1-2",
        "title": "組立て、解体及び変更の作業の方法",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "点検及び補修",
        "legal_min": 40
      },
      {
        "id": "1-4",
        "title": "登り桟橋、朝顔等の構造と作業の方法",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "工事用設備及び機械の取扱い",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "器具及び工具",
        "legal_min": 10
      },
      {
        "id": "2-3",
        "title": "悪天候時における作業の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "墜落による危険の防止",
        "legal_min": 35
      },
      {
        "id": "3-2",
        "title": "飛来落下・倒壊による危険の防止",
        "legal_min": 25
      },
      {
        "id": "3-3",
        "title": "保護具の使用方法と保守点検",
        "legal_min": 20
      },
      {
        "id": "3-4",
        "title": "感電・熱中症その他の危険の防止",
        "legal_min": 10
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 35
      },
      {
        "id": "4-2",
        "title": "事業者と作業者の義務、企業責任",
        "legal_min": 25
      }
    ]
  },
  "shokucho": {
    "lessons": 13,
    "requiredSec": 47700,
    "list": [
      {
        "id": "1-1",
        "title": "作業方法の決定と作業手順書",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "労働者の配置と作業前打合せ",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "部下に対する指導・育成",
        "legal_min": 75
      },
      {
        "id": "2-2",
        "title": "作業中の監督と指示",
        "legal_min": 75
      },
      {
        "id": "3-1",
        "title": "危険性又は有害性等の調査の方法",
        "legal_min": 65
      },
      {
        "id": "3-2",
        "title": "調査の結果に基づき講ずる措置",
        "legal_min": 65
      },
      {
        "id": "3-3",
        "title": "設備、作業等の具体的な改善の方法",
        "legal_min": 65
      },
      {
        "id": "4-1",
        "title": "異常時における措置",
        "legal_min": 45
      },
      {
        "id": "4-2",
        "title": "災害発生時における措置",
        "legal_min": 45
      },
      {
        "id": "5-1",
        "title": "保守管理と安全衛生点検",
        "legal_min": 60
      },
      {
        "id": "5-2",
        "title": "災害防止への関心の保持と創意工夫",
        "legal_min": 60
      },
      {
        "id": "6-1",
        "title": "安全衛生責任者の職務と作業間の連絡調整",
        "legal_min": 60
      },
      {
        "id": "6-2",
        "title": "安全施工サイクルによる安全衛生活動",
        "legal_min": 60
      }
    ]
  },
  "ishiwata": {
    "lessons": 13,
    "requiredSec": 16200,
    "list": [
      {
        "id": "1-1",
        "title": "石綿の性状",
        "legal_min": 10
      },
      {
        "id": "1-2",
        "title": "石綿による疾病の病理及び症状",
        "legal_min": 10
      },
      {
        "id": "1-3",
        "title": "喫煙の影響",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "石綿を含有する製品の種類及び用途",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "事前調査の方法",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "解体等の作業の方法",
        "legal_min": 20
      },
      {
        "id": "3-2",
        "title": "湿潤化の方法",
        "legal_min": 15
      },
      {
        "id": "3-3",
        "title": "作業場所の隔離の方法",
        "legal_min": 15
      },
      {
        "id": "3-4",
        "title": "その他の発散を抑制するための措置",
        "legal_min": 10
      },
      {
        "id": "4-1",
        "title": "保護具の種類と性能",
        "legal_min": 30
      },
      {
        "id": "4-2",
        "title": "保護具の使用方法及び管理",
        "legal_min": 30
      },
      {
        "id": "5-1",
        "title": "法、令、安衛則及び石綿則中の関係条項",
        "legal_min": 35
      },
      {
        "id": "5-2",
        "title": "石綿等による健康障害の防止",
        "legal_min": 25
      }
    ]
  },
  "kousho": {
    "lessons": 8,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "高所作業車の種類及び用途",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "作業装置の構造及び取扱いの方法",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "附属装置の構造及び取扱いの方法",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "内燃機関の構造及び取扱いの方法",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "動力伝達装置及び走行装置の種類",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "運転に必要な力学",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "感電による危険性",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "harness": {
    "lessons": 15,
    "requiredSec": 16200,
    "list": [
      {
        "id": "1-1",
        "title": "作業に用いる設備の種類、構造及び取扱い方法",
        "legal_min": 25
      },
      {
        "id": "1-2",
        "title": "作業に用いる設備の点検及び整備の方法",
        "legal_min": 15
      },
      {
        "id": "1-3",
        "title": "作業の方法",
        "legal_min": 20
      },
      {
        "id": "2-1",
        "title": "フルハーネスとランヤードの種類及び構造",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "フルハーネスの装着の方法",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "ランヤードの取付け方法及び選定方法",
        "legal_min": 30
      },
      {
        "id": "2-4",
        "title": "墜落制止用器具の点検及び整備の方法",
        "legal_min": 20
      },
      {
        "id": "2-5",
        "title": "関連器具の使用方法",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "墜落による労働災害の防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-2",
        "title": "落下物による危険防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-3",
        "title": "感電防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-4",
        "title": "保護帽の使用方法及び保守点検の方法",
        "legal_min": 10
      },
      {
        "id": "3-5",
        "title": "事故発生時の措置",
        "legal_min": 10
      },
      {
        "id": "3-6",
        "title": "その他作業に伴う災害及びその防止方法",
        "legal_min": 10
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 30
      }
    ]
  },
  "rope": {
    "lessons": 12,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "ロープ高所作業の方法",
        "legal_min": 25
      },
      {
        "id": "1-2",
        "title": "作業に用いる設備の種類、構造及び取扱い方法",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "作業に用いる設備の点検及び整備の方法",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "メインロープ等の種類、構造、強度及び取扱い方法",
        "legal_min": 35
      },
      {
        "id": "2-2",
        "title": "メインロープ等の点検及び整備の方法",
        "legal_min": 25
      },
      {
        "id": "3-1",
        "title": "墜落による労働災害の防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-2",
        "title": "落下物による危険防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-3",
        "title": "感電防止のための措置",
        "legal_min": 10
      },
      {
        "id": "3-4",
        "title": "保護帽の使用方法及び保守点検の方法",
        "legal_min": 10
      },
      {
        "id": "3-5",
        "title": "事故発生時の措置",
        "legal_min": 10
      },
      {
        "id": "3-6",
        "title": "その他作業に伴う災害及びその防止方法",
        "legal_min": 10
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "funjin": {
    "lessons": 10,
    "requiredSec": 16200,
    "list": [
      {
        "id": "1-1",
        "title": "粉じんの発散防止対策の種類及び概要",
        "legal_min": 35
      },
      {
        "id": "1-2",
        "title": "換気の種類及び概要",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "設備の保守点検の方法",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "作業環境の点検の方法",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "清掃の方法",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "呼吸用保護具の種類、性能、使用方法及び管理",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "粉じんの有害性",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "粉じんによる疾病の病理及び症状",
        "legal_min": 25
      },
      {
        "id": "4-3",
        "title": "健康管理の方法",
        "legal_min": 20
      },
      {
        "id": "5-1",
        "title": "法、令、安衛則及び粉じん則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "forklift": {
    "lessons": 14,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "種類と、原動機・動力伝達装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "走行装置・かじ取り装置・制動装置",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "走行に関する附属装置と取扱い方法",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "荷役装置（マスト・フォーク・チェーン）",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "油圧装置と安全弁",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "ヘッドガード・バックレストと荷役の附属装置・取扱い方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 10
      },
      {
        "id": "3-2",
        "title": "重量",
        "legal_min": 7
      },
      {
        "id": "3-3",
        "title": "重心及び物の安定",
        "legal_min": 12
      },
      {
        "id": "3-4",
        "title": "速度及び加速度",
        "legal_min": 8
      },
      {
        "id": "3-5",
        "title": "荷重",
        "legal_min": 8
      },
      {
        "id": "3-6",
        "title": "応力",
        "legal_min": 7
      },
      {
        "id": "3-7",
        "title": "材料の強さ",
        "legal_min": 8
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "tailgate": {
    "lessons": 7,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "種類、構造及び取扱い方法",
        "legal_min": 50
      },
      {
        "id": "1-2",
        "title": "点検及び整備の方法",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "荷の種類及び取扱い方法",
        "legal_min": 35
      },
      {
        "id": "2-2",
        "title": "台車の種類、構造及び取扱い方法",
        "legal_min": 30
      },
      {
        "id": "2-3",
        "title": "保護具の着用",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "災害防止",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 30
      }
    ]
  },
  "toishi": {
    "lessons": 11,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "研削盤の種類及び構造並びにその取扱い方法",
        "legal_min": 35
      },
      {
        "id": "1-2",
        "title": "といしの種類、構成、表示及び安全度並びにその取扱い方法",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "取付け具",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "覆い",
        "legal_min": 15
      },
      {
        "id": "1-5",
        "title": "保護具",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "研削盤とといしとの適合確認",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "といしの外観検査及び打音検査",
        "legal_min": 15
      },
      {
        "id": "2-3",
        "title": "取付け具の締付け方法及び締付け力",
        "legal_min": 12
      },
      {
        "id": "2-4",
        "title": "バランスの取り方",
        "legal_min": 8
      },
      {
        "id": "2-5",
        "title": "試運転の方法",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "teiatsu": {
    "lessons": 23,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "低圧の電気の危険性",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "短絡",
        "legal_min": 10
      },
      {
        "id": "1-3",
        "title": "漏電",
        "legal_min": 12
      },
      {
        "id": "1-4",
        "title": "接地",
        "legal_min": 11
      },
      {
        "id": "1-5",
        "title": "電気絶縁",
        "legal_min": 12
      },
      {
        "id": "2-1",
        "title": "配電設備",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "変電設備",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "配線",
        "legal_min": 25
      },
      {
        "id": "2-4",
        "title": "電気使用設備",
        "legal_min": 25
      },
      {
        "id": "2-5",
        "title": "保守及び点検",
        "legal_min": 25
      },
      {
        "id": "3-1",
        "title": "絶縁用保護具",
        "legal_min": 12
      },
      {
        "id": "3-2",
        "title": "絶縁用防具",
        "legal_min": 10
      },
      {
        "id": "3-3",
        "title": "活線作業用器具",
        "legal_min": 10
      },
      {
        "id": "3-4",
        "title": "検電器",
        "legal_min": 12
      },
      {
        "id": "3-5",
        "title": "その他の安全作業用具",
        "legal_min": 8
      },
      {
        "id": "3-6",
        "title": "管理",
        "legal_min": 8
      },
      {
        "id": "4-1",
        "title": "充電電路の防護",
        "legal_min": 20
      },
      {
        "id": "4-2",
        "title": "作業者の絶縁保護",
        "legal_min": 20
      },
      {
        "id": "4-3",
        "title": "停電電路に対する措置",
        "legal_min": 25
      },
      {
        "id": "4-4",
        "title": "作業管理",
        "legal_min": 20
      },
      {
        "id": "4-5",
        "title": "救急処置",
        "legal_min": 20
      },
      {
        "id": "4-6",
        "title": "災害防止",
        "legal_min": 15
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "winch": {
    "lessons": 10,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "種類と、原動機・動力伝達装置・電気装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "ブレーキ・クラッチ・巻胴・逆転防止装置",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "信号装置・連結器材・安全装置・各種計器",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "巻上用ワイヤロープの構造及び取扱いの方法",
        "legal_min": 35
      },
      {
        "id": "1-5",
        "title": "巻上げ機の据付方法",
        "legal_min": 35
      },
      {
        "id": "2-1",
        "title": "合図方法",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "荷掛方法",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "連結方法",
        "legal_min": 25
      },
      {
        "id": "2-4",
        "title": "点検方法",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "roller": {
    "lessons": 9,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "ローラーの種類及び用途",
        "legal_min": 50
      },
      {
        "id": "1-2",
        "title": "動力伝達装置",
        "legal_min": 35
      },
      {
        "id": "1-3",
        "title": "作業装置（ロール・振動装置・散水装置）",
        "legal_min": 40
      },
      {
        "id": "1-4",
        "title": "かじ取り装置",
        "legal_min": 30
      },
      {
        "id": "1-5",
        "title": "ブレーキ",
        "legal_min": 35
      },
      {
        "id": "1-6",
        "title": "電気装置・警報装置・附属装置と取扱いの方法",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "運転に必要な力学",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "ローラーによる施工方法",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "chainsaw": {
    "lessons": 12,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "伐倒の方法",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "伐倒の合図",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "退避の方法",
        "legal_min": 35
      },
      {
        "id": "1-4",
        "title": "かかり木の種類及びその処理",
        "legal_min": 50
      },
      {
        "id": "1-5",
        "title": "造材の方法",
        "legal_min": 45
      },
      {
        "id": "1-6",
        "title": "下肢の切創防止用保護衣等の着用",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "チェーンソーの種類、構造及び取扱い方法",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "チェーンソーの点検及び整備の方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "ソーチェーンの目立ての方法",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "振動障害の原因及び症状",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "振動障害の予防措置",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "arc": {
    "lessons": 15,
    "requiredSec": 39600,
    "list": [
      {
        "id": "1-1",
        "title": "アーク溶接等の基礎理論",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "電気に関する基礎知識",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "直流アーク溶接機",
        "legal_min": 35
      },
      {
        "id": "2-2",
        "title": "交流アーク溶接機",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "交流アーク溶接機用自動電撃防止装置",
        "legal_min": 45
      },
      {
        "id": "2-4",
        "title": "溶接棒等及び溶接棒等のホルダー",
        "legal_min": 35
      },
      {
        "id": "2-5",
        "title": "配線",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "作業前の点検整備",
        "legal_min": 55
      },
      {
        "id": "3-2",
        "title": "溶接の方法",
        "legal_min": 60
      },
      {
        "id": "3-3",
        "title": "溶断・ガウジングの方法",
        "legal_min": 45
      },
      {
        "id": "3-4",
        "title": "溶接部の点検",
        "legal_min": 45
      },
      {
        "id": "3-5",
        "title": "作業後の処置",
        "legal_min": 45
      },
      {
        "id": "3-6",
        "title": "災害防止（感電・アーク光・火災）",
        "legal_min": 60
      },
      {
        "id": "3-7",
        "title": "災害防止（ヒューム・ガス・換気・保護具）",
        "legal_min": 50
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "compressor": {
    "lessons": 11,
    "requiredSec": 36000,
    "list": [
      {
        "id": "1-1",
        "title": "圧気工法の概要",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "圧気工法による業務の危険性",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "事故発生時の措置",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "送気設備の種類と構造",
        "legal_min": 60
      },
      {
        "id": "2-2",
        "title": "送気設備の取扱い方法",
        "legal_min": 60
      },
      {
        "id": "2-3",
        "title": "送気設備の点検修理の方法",
        "legal_min": 60
      },
      {
        "id": "2-4",
        "title": "自動警報装置の構造及び取扱い方法",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "高気圧障害の予防方法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "関係法令（この持ち場にかかる決まり）",
        "legal_min": 60
      }
    ]
  },
  "soukiroom": {
    "lessons": 12,
    "requiredSec": 36000,
    "list": [
      {
        "id": "1-1",
        "title": "圧気工法の概要",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "圧気工法による業務の危険性",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "事故発生時の措置",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "送気の方法",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "排気と換気の方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "緊急時の減圧法",
        "legal_min": 60
      },
      {
        "id": "2-4",
        "title": "圧気工法に係る設備の種類及び取扱い方法",
        "legal_min": 50
      },
      {
        "id": "2-5",
        "title": "圧気工法に係る設備の修理の方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "高気圧障害の予防方法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "関係法令（この持ち場にかかる決まり）",
        "legal_min": 60
      }
    ]
  },
  "kikoushitsu": {
    "lessons": 12,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "圧気工法の概要",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "圧気工法による業務の危険性",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "事故発生時の措置",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "加圧の仕方",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "減圧の仕方",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "換気の仕方",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "緊急時の減圧法",
        "legal_min": 45
      },
      {
        "id": "2-5",
        "title": "緊急時の換気法",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "高気圧障害の予防方法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "関係法令（この持ち場にかかる決まり）",
        "legal_min": 60
      }
    ]
  },
  "soukisensui": {
    "lessons": 12,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "潜水業務の基礎知識",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "潜水業務の危険性",
        "legal_min": 30
      },
      {
        "id": "1-3",
        "title": "事故発生時の措置",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "送気の方法",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "送気の量と、深さとの関係",
        "legal_min": 30
      },
      {
        "id": "2-3",
        "title": "緊急時の減圧法",
        "legal_min": 50
      },
      {
        "id": "2-4",
        "title": "潜水業務に関する設備の種類及び取扱い方法",
        "legal_min": 35
      },
      {
        "id": "2-5",
        "title": "潜水業務に関する設備の修理の方法",
        "legal_min": 25
      },
      {
        "id": "3-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "高気圧障害の予防方法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "関係法令（この持ち場にかかる決まり）",
        "legal_min": 60
      }
    ]
  },
  "saiatsushitsu": {
    "lessons": 10,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "高気圧障害の予防方法と、見分け方",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "再圧室に関する基礎知識",
        "legal_min": 45
      },
      {
        "id": "2-2",
        "title": "再圧室の作りと、付属の設備",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "標準再圧治療法",
        "legal_min": 55
      },
      {
        "id": "2-4",
        "title": "治療中の見守りと、記録",
        "legal_min": 45
      },
      {
        "id": "3-1",
        "title": "人工呼吸法",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "人工そ生法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "関係法令（再圧室にかかる決まり）",
        "legal_min": 60
      }
    ]
  },
  "kouatsushitsu": {
    "lessons": 11,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "圧気工法の概要",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "圧気工法による業務の危険性",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "送気設備の種類及び機能",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "気閘室の機能",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "通話装置の取扱い方法",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "急激な圧力低下による異常出水等の防止方法",
        "legal_min": 60
      },
      {
        "id": "3-2",
        "title": "火災等の防止方法",
        "legal_min": 50
      },
      {
        "id": "3-3",
        "title": "事故発生時の措置",
        "legal_min": 40
      },
      {
        "id": "3-4",
        "title": "保護具の使用方法",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "高気圧障害の病理と症状",
        "legal_min": 60
      },
      {
        "id": "5-1",
        "title": "関係法令（労働基準法と高圧則）",
        "legal_min": 60
      }
    ]
  },
  "senryouka": {
    "lessons": 8,
    "requiredSec": 9000,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "放射線測定の方法",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "外部放射線による線量当量率の監視の方法",
        "legal_min": 10
      },
      {
        "id": "2-3",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "josendojo": {
    "lessons": 14,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "土壌等の除染等の業務に係る作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "放射線測定の方法",
        "legal_min": 5
      },
      {
        "id": "2-3",
        "title": "外部放射線による線量当量率の監視の方法",
        "legal_min": 5
      },
      {
        "id": "2-4",
        "title": "汚染防止措置の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "保護具の性能及び使用方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する機械等の種類と構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する機械等の取扱いと点検",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "josenshushu": {
    "lessons": 14,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "除去土壌の収集等に係る業務に係る作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "放射線測定の方法",
        "legal_min": 5
      },
      {
        "id": "2-3",
        "title": "外部放射線による線量当量率の監視の方法",
        "legal_min": 5
      },
      {
        "id": "2-4",
        "title": "汚染防止措置の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "保護具の性能及び使用方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する機械等の種類と構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する機械等の取扱いと点検",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "josenhaiki": {
    "lessons": 14,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "汚染廃棄物の収集等に係る業務に係る作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "放射線測定の方法",
        "legal_min": 5
      },
      {
        "id": "2-3",
        "title": "外部放射線による線量当量率の監視の方法",
        "legal_min": 5
      },
      {
        "id": "2-4",
        "title": "汚染防止措置の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "保護具の性能及び使用方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する機械等の種類と構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する機械等の取扱いと点検",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "josentokutei": {
    "lessons": 13,
    "requiredSec": 12600,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "特定汚染土壌等取扱業務に係る作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "放射線測定の方法",
        "legal_min": 5
      },
      {
        "id": "2-3",
        "title": "外部放射線による線量当量率の監視の方法",
        "legal_min": 5
      },
      {
        "id": "2-4",
        "title": "汚染防止措置の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "保護具の性能及び使用方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する機械等の名称及び用途",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "josentokuteigai": {
    "lessons": 11,
    "requiredSec": 12600,
    "list": [
      {
        "id": "1-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "被ばく限度",
        "legal_min": 20
      },
      {
        "id": "2-1",
        "title": "特定汚染土壌等取扱業務に係る作業の方法及び順序",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "放射線測定の方法",
        "legal_min": 5
      },
      {
        "id": "2-3",
        "title": "汚染防止措置の方法",
        "legal_min": 10
      },
      {
        "id": "2-4",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "保護具の性能及び使用方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する機械等の名称及び用途",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "tokureikinkyu": {
    "lessons": 20,
    "requiredSec": 23400,
    "list": [
      {
        "id": "1-1",
        "title": "重大事故等に対処するための作業の方法",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "特例緊急作業における必要な体制の整備",
        "legal_min": 15
      },
      {
        "id": "1-3",
        "title": "特例緊急作業における連絡の方法",
        "legal_min": 15
      },
      {
        "id": "1-4",
        "title": "特例緊急作業における放射線測定の方法",
        "legal_min": 15
      },
      {
        "id": "1-5",
        "title": "外部放射線による線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 20
      },
      {
        "id": "1-6",
        "title": "作業を行う場所の汚染の状態の検査及び汚染の影響の低減のために必要な措置の方法",
        "legal_min": 20
      },
      {
        "id": "1-7",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 15
      },
      {
        "id": "1-8",
        "title": "特例緊急作業に使用する保護具の性能及び使用方法",
        "legal_min": 20
      },
      {
        "id": "1-9",
        "title": "応急手当の方法",
        "legal_min": 15
      },
      {
        "id": "1-10",
        "title": "重大事故等及び重大事故等への対処の事例",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "重大事故等に対処するための機能を有する施設及び設備の構造",
        "legal_min": 60
      },
      {
        "id": "2-2",
        "title": "重大事故等に対処するための機能を有する施設及び設備の取扱いの方法",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 10
      },
      {
        "id": "3-2",
        "title": "特例緊急作業において電離放射線が生体に与える影響",
        "legal_min": 10
      },
      {
        "id": "3-3",
        "title": "特例緊急作業における健康管理の方法",
        "legal_min": 10
      },
      {
        "id": "3-4",
        "title": "特例緊急被ばく限度",
        "legal_min": 5
      },
      {
        "id": "3-5",
        "title": "特例緊急作業における被ばく線量測定の方法",
        "legal_min": 10
      },
      {
        "id": "3-6",
        "title": "被ばく線量測定の結果の確認、記録等の方法",
        "legal_min": 10
      },
      {
        "id": "3-7",
        "title": "被ばく限度を超えた労働者に係る被ばく線量の管理の方法",
        "legal_min": 5
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 30
      }
    ]
  },
  "haikihasai": {
    "lessons": 17,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "事故由来廃棄物等の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "破砕等、運搬及び貯蔵の作業の方法及び順序",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 10
      },
      {
        "id": "2-4",
        "title": "放射線測定の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-8",
        "title": "保護具の性能及び使用方法",
        "legal_min": 5
      },
      {
        "id": "2-9",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する設備の構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する設備の取扱いの方法",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "4-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "4-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "haikishokyaku": {
    "lessons": 17,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "事故由来廃棄物等の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "焼却、運搬及び貯蔵の作業の方法及び順序",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 10
      },
      {
        "id": "2-4",
        "title": "放射線測定の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-8",
        "title": "保護具の性能及び使用方法",
        "legal_min": 5
      },
      {
        "id": "2-9",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する設備の構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する設備の取扱いの方法",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "4-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "4-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "haikiumetate": {
    "lessons": 17,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "事故由来廃棄物等の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "運搬、貯蔵及び埋立ての作業の方法及び順序",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 10
      },
      {
        "id": "2-4",
        "title": "放射線測定の方法",
        "legal_min": 10
      },
      {
        "id": "2-5",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-7",
        "title": "身体等の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-8",
        "title": "保護具の性能及び使用方法",
        "legal_min": 5
      },
      {
        "id": "2-9",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 5
      },
      {
        "id": "3-1",
        "title": "作業に使用する設備の構造",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "作業に使用する設備の取扱いの方法",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 20
      },
      {
        "id": "4-3",
        "title": "被ばく限度及び被ばく線量測定の方法",
        "legal_min": 15
      },
      {
        "id": "4-4",
        "title": "被ばく線量測定の結果の確認及び記録等の方法",
        "legal_min": 10
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "xrayki": {
    "lessons": 10,
    "requiredSec": 16200,
    "list": [
      {
        "id": "1-1",
        "title": "作業の手順",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "電離放射線の測定",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく防止の方法",
        "legal_min": 25
      },
      {
        "id": "1-4",
        "title": "事故時の措置",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "エックス線装置の原理",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "エックス線管、高電圧発生器及び制御器の構造及び機能",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "エックス線装置の操作及び点検",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "3-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "gammaki": {
    "lessons": 12,
    "requiredSec": 16200,
    "list": [
      {
        "id": "1-1",
        "title": "作業の手順",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "電離放射線の測定",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく防止の方法",
        "legal_min": 25
      },
      {
        "id": "1-4",
        "title": "事故時の措置",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "ガンマ線照射装置の種類及び型式",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "線源容器の構造及び機能",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "放射線源送出し装置又は遠隔操作装置の構造及び機能",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "放射線源の構造及び放射性物質の性質",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "ガンマ線照射装置の操作及び点検",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "3-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "xraygammaki": {
    "lessons": 15,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "作業の手順",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "電離放射線の測定",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "被ばく防止の方法",
        "legal_min": 25
      },
      {
        "id": "1-4",
        "title": "事故時の措置",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "エックス線装置の原理",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "エックス線管、高電圧発生器及び制御器の構造及び機能",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "エックス線装置の操作及び点検",
        "legal_min": 30
      },
      {
        "id": "2-4",
        "title": "ガンマ線照射装置の種類及び型式",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "線源容器の構造及び機能",
        "legal_min": 20
      },
      {
        "id": "2-6",
        "title": "放射線源送出し装置又は遠隔操作装置の構造及び機能",
        "legal_min": 20
      },
      {
        "id": "2-7",
        "title": "放射線源の構造及び放射性物質の性質",
        "legal_min": 15
      },
      {
        "id": "2-8",
        "title": "ガンマ線照射装置の操作及び点検",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "3-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "kakunenkakou": {
    "lessons": 13,
    "requiredSec": 19800,
    "list": [
      {
        "id": "1-1",
        "title": "核燃料物質又は使用済燃料の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "汚染された物の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "取り扱う作業の方法及び順序",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-4",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "設備の構造",
        "legal_min": 45
      },
      {
        "id": "3-2",
        "title": "設備の取扱いの方法",
        "legal_min": 45
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "kakunensaishori": {
    "lessons": 13,
    "requiredSec": 19800,
    "list": [
      {
        "id": "1-1",
        "title": "核燃料物質又は使用済燃料の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "汚染された物の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "取り扱う作業の方法及び順序",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-4",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "設備の構造",
        "legal_min": 45
      },
      {
        "id": "3-2",
        "title": "設備の取扱いの方法",
        "legal_min": 45
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "kakunenshiyou": {
    "lessons": 13,
    "requiredSec": 19800,
    "list": [
      {
        "id": "1-1",
        "title": "核燃料物質又は使用済燃料の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "汚染された物の種類及び性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "取り扱う作業の方法及び順序",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-4",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "設備の構造",
        "legal_min": 45
      },
      {
        "id": "3-2",
        "title": "設備の取扱いの方法",
        "legal_min": 45
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "kakunengenshiro": {
    "lessons": 13,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "核燃料物質又は使用済燃料の種類及び性状",
        "legal_min": 15
      },
      {
        "id": "1-2",
        "title": "汚染された物の種類及び性状",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "管理区域に関すること",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "取り扱う作業の方法及び順序",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "汚染された設備の保守及び点検の作業の方法及び順序",
        "legal_min": 15
      },
      {
        "id": "2-4",
        "title": "線量当量率及び空気中の放射性物質の濃度の監視の方法",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "天井、床、壁、設備等の表面の汚染の状態の検査及び汚染の除去の方法",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "異常な事態が発生した場合における応急の措置の方法",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "設備の構造",
        "legal_min": 45
      },
      {
        "id": "3-2",
        "title": "設備の取扱いの方法",
        "legal_min": 45
      },
      {
        "id": "4-1",
        "title": "電離放射線の種類及び性質",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電離放射線が生体の細胞、組織、器官及び全身に与える影響",
        "legal_min": 15
      },
      {
        "id": "5-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "tetraalkyl": {
    "lessons": 9,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "四アルキル鉛の性状",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "四アルキル鉛中毒の病理及び症状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "ドラムかん及び設備の取扱い方法",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "保護具の種類、性能及び使用方法",
        "legal_min": 60
      },
      {
        "id": "4-1",
        "title": "洗身、保護具の洗浄及び身体等の清潔の保持の方法",
        "legal_min": 60
      },
      {
        "id": "5-1",
        "title": "合図又は警報の内容及び退避の場所",
        "legal_min": 30
      },
      {
        "id": "5-2",
        "title": "除毒剤、拡散防止剤及び補修剤の使用方法",
        "legal_min": 30
      },
      {
        "id": "6-1",
        "title": "関係法令",
        "legal_min": 35
      },
      {
        "id": "6-2",
        "title": "四アルキル鉛中毒を防止するため当該業務について必要な事項",
        "legal_min": 25
      }
    ]
  },
  "boiler": {
    "lessons": 13,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "熱及び蒸気",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "小型ボイラーの種類",
        "legal_min": 35
      },
      {
        "id": "1-3",
        "title": "主要部分の構造",
        "legal_min": 45
      },
      {
        "id": "2-1",
        "title": "安全装置",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "圧力計",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "水面測定装置",
        "legal_min": 30
      },
      {
        "id": "2-4",
        "title": "給水装置",
        "legal_min": 20
      },
      {
        "id": "2-5",
        "title": "吹出装置",
        "legal_min": 10
      },
      {
        "id": "2-6",
        "title": "自動制御装置",
        "legal_min": 10
      },
      {
        "id": "3-1",
        "title": "燃料の種類",
        "legal_min": 35
      },
      {
        "id": "3-2",
        "title": "燃焼方式及び燃焼装置",
        "legal_min": 50
      },
      {
        "id": "3-3",
        "title": "通風装置",
        "legal_min": 35
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "gondola": {
    "lessons": 10,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 25
      },
      {
        "id": "1-2",
        "title": "昇降装置",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "安全装置",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "ブレーキ機能",
        "legal_min": 15
      },
      {
        "id": "1-5",
        "title": "取扱い方法",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "電気に関する基礎知識",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "電動機",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "開閉器等電気を通ずる機械器具",
        "legal_min": 30
      },
      {
        "id": "2-4",
        "title": "感電による危険性",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "derrick": {
    "lessons": 17,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "主要構造部分",
        "legal_min": 45
      },
      {
        "id": "1-3",
        "title": "作動装置",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "安全装置",
        "legal_min": 30
      },
      {
        "id": "1-5",
        "title": "ブレーキ機能",
        "legal_min": 20
      },
      {
        "id": "1-6",
        "title": "取扱い方法",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "電気に関する基礎知識",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "電動機",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "開閉器、コントローラー等電気を通ずる機械器具",
        "legal_min": 35
      },
      {
        "id": "2-4",
        "title": "電路の点検及び補修",
        "legal_min": 35
      },
      {
        "id": "2-5",
        "title": "感電による危険性",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "重心",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "荷重",
        "legal_min": 25
      },
      {
        "id": "3-4",
        "title": "ワイヤロープ、フツク及びつり具の強さ",
        "legal_min": 25
      },
      {
        "id": "3-5",
        "title": "ワイヤロープの掛け方と荷重との関係",
        "legal_min": 20
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "kensetsulift": {
    "lessons": 10,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 25
      },
      {
        "id": "1-2",
        "title": "昇降装置",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "安全装置",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "ブレーキ機能",
        "legal_min": 20
      },
      {
        "id": "1-5",
        "title": "取扱い方法",
        "legal_min": 20
      },
      {
        "id": "2-1",
        "title": "電気に関する基礎知識",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "電動機",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "開閉器等電気を通ずる機械器具",
        "legal_min": 30
      },
      {
        "id": "2-4",
        "title": "感電による危険性",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "mobilecrane": {
    "lessons": 16,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "主要構造部分",
        "legal_min": 35
      },
      {
        "id": "1-3",
        "title": "作動装置",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "安全装置",
        "legal_min": 35
      },
      {
        "id": "1-5",
        "title": "ブレーキ機能",
        "legal_min": 20
      },
      {
        "id": "1-6",
        "title": "取扱い方法",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "内燃機関",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "蒸気機関",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "油圧駆動装置",
        "legal_min": 55
      },
      {
        "id": "2-4",
        "title": "感電による危険性",
        "legal_min": 55
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "重心",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "荷重",
        "legal_min": 25
      },
      {
        "id": "3-4",
        "title": "ワイヤロープ、フツク及びつり具の強さ",
        "legal_min": 25
      },
      {
        "id": "3-5",
        "title": "ワイヤロープの掛け方と荷重との関係",
        "legal_min": 20
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "crane": {
    "lessons": 17,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "主要構造部分",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "作動装置",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "安全装置",
        "legal_min": 30
      },
      {
        "id": "1-5",
        "title": "ブレーキ機能",
        "legal_min": 25
      },
      {
        "id": "1-6",
        "title": "取扱い方法",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "電気に関する基礎知識",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "電動機",
        "legal_min": 35
      },
      {
        "id": "2-3",
        "title": "開閉器、コントローラー等電気を通ずる機械器具",
        "legal_min": 35
      },
      {
        "id": "2-4",
        "title": "電路の点検及び補修",
        "legal_min": 35
      },
      {
        "id": "2-5",
        "title": "感電による危険性",
        "legal_min": 35
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "重心",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "荷重",
        "legal_min": 25
      },
      {
        "id": "3-4",
        "title": "ワイヤロープ、フック及びつり具の強さ",
        "legal_min": 25
      },
      {
        "id": "3-5",
        "title": "ワイヤロープの掛け方と荷重との関係",
        "legal_min": 20
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "tamakake": {
    "lessons": 9,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "種類及び型式",
        "legal_min": 20
      },
      {
        "id": "1-2",
        "title": "構造及び機能",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "安全装置及びブレーキ",
        "legal_min": 20
      },
      {
        "id": "2-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "重心と物の安定・摩擦・重量・荷重",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "玉掛用具の選定及び使用の方法",
        "legal_min": 50
      },
      {
        "id": "3-2",
        "title": "基本動作（安全作業方法を含む）",
        "legal_min": 40
      },
      {
        "id": "3-3",
        "title": "合図の方法",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "関係法令",
        "legal_min": 60
      }
    ]
  },
  "tokushu": {
    "lessons": 16,
    "requiredSec": 46800,
    "list": [
      {
        "id": "1-1",
        "title": "危険物の種類、性状及び危険性",
        "legal_min": 70
      },
      {
        "id": "1-2",
        "title": "化学反応の概要",
        "legal_min": 50
      },
      {
        "id": "1-3",
        "title": "発熱反応等の危険性",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "特殊化学設備の種類及び構造",
        "legal_min": 70
      },
      {
        "id": "2-2",
        "title": "計測装置、制御装置、安全装置等の構造",
        "legal_min": 70
      },
      {
        "id": "2-3",
        "title": "特殊化学設備用材料",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "使用開始時の取扱い方法",
        "legal_min": 40
      },
      {
        "id": "3-2",
        "title": "使用中の取扱い方法",
        "legal_min": 40
      },
      {
        "id": "3-3",
        "title": "使用休止時の取扱い方法",
        "legal_min": 30
      },
      {
        "id": "3-4",
        "title": "点検及び検査の方法",
        "legal_min": 35
      },
      {
        "id": "3-5",
        "title": "停電時等の異常時における応急の処置",
        "legal_min": 35
      },
      {
        "id": "4-1",
        "title": "整備及び修理の手順",
        "legal_min": 60
      },
      {
        "id": "4-2",
        "title": "通風及び換気",
        "legal_min": 40
      },
      {
        "id": "4-3",
        "title": "保護具の着用",
        "legal_min": 40
      },
      {
        "id": "4-4",
        "title": "ガス検知",
        "legal_min": 40
      },
      {
        "id": "5-1",
        "title": "法、令、安衛則及びボイラー及び圧力容器安全規則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "tire": {
    "lessons": 6,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "タイヤの種類及び構造",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "リムへの組込み及びその状況の点検の方法",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "圧力調節装置の種類、構造及び取扱いの方法",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "空気圧縮機を用いてタイヤに空気を充てんする方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "安全囲い等の使用方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "robotkensa": {
    "lessons": 7,
    "requiredSec": 32400,
    "list": [
      {
        "id": "1-1",
        "title": "産業用ロボットの種類、制御方式、駆動方式",
        "legal_min": 80
      },
      {
        "id": "1-2",
        "title": "各部の構造及び機能並びに取扱いの方法",
        "legal_min": 80
      },
      {
        "id": "1-3",
        "title": "制御部品の種類及び特性",
        "legal_min": 80
      },
      {
        "id": "2-1",
        "title": "検査等の作業の方法",
        "legal_min": 100
      },
      {
        "id": "2-2",
        "title": "検査等の作業の危険性",
        "legal_min": 80
      },
      {
        "id": "2-3",
        "title": "関連する機械等との連動の方法",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "robotkyoji": {
    "lessons": 6,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "産業用ロボットの種類",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "各部の機能及び取扱いの方法",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "教示等の作業の方法",
        "legal_min": 100
      },
      {
        "id": "2-2",
        "title": "教示等の作業の危険性",
        "legal_min": 80
      },
      {
        "id": "2-3",
        "title": "関連する機械等との連動の方法",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kidou": {
    "lessons": 9,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "動力車の種類及び用途",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "原動機・動力伝達装置・制御装置・ブレーキ・台車",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "連結装置・電気装置・逸走防止装置・安全装置・計器",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "軌条・まくら木・道床",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "分岐及びてつさ・逸走防止装置",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "信号装置",
        "legal_min": 20
      },
      {
        "id": "3-2",
        "title": "合図及び誘導の方法",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "車両の連結の方法",
        "legal_min": 20
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "jack": {
    "lessons": 7,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "ジャッキ式つり上げ機械の種類及び用途",
        "legal_min": 50
      },
      {
        "id": "1-2",
        "title": "保持機構・作動装置・制御装置と、同時開放防止機構等の安全装置",
        "legal_min": 80
      },
      {
        "id": "1-3",
        "title": "据付け方法",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "調整又は運転に必要な力学",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "調整方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "合図方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "boring": {
    "lessons": 7,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "ボーリングマシンの種類及び用途",
        "legal_min": 90
      },
      {
        "id": "1-2",
        "title": "原動機・動力伝達装置・作業装置",
        "legal_min": 80
      },
      {
        "id": "1-3",
        "title": "巻上げ装置と附属装置",
        "legal_min": 70
      },
      {
        "id": "2-1",
        "title": "運転に必要な力学及び土質工学",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "土木施工の方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "ワイヤロープ及び補助具",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "concrete": {
    "lessons": 7,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "作業装置の種類及び用途（ポンプ・ブーム・輸送管）",
        "legal_min": 100
      },
      {
        "id": "1-2",
        "title": "作業装置の構造",
        "legal_min": 70
      },
      {
        "id": "1-3",
        "title": "作業装置の取扱いの方法",
        "legal_min": 70
      },
      {
        "id": "2-1",
        "title": "操作のために必要な力学",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "コンクリートの種類及び性質",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "コンクリート打設の方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kisosousa": {
    "lessons": 7,
    "requiredSec": 18000,
    "list": [
      {
        "id": "1-1",
        "title": "作業装置の種類及び用途",
        "legal_min": 80
      },
      {
        "id": "1-2",
        "title": "作業装置の構造",
        "legal_min": 50
      },
      {
        "id": "1-3",
        "title": "作業装置の取扱い方法",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "操作のために必要な力学及び土質工学",
        "legal_min": 25
      },
      {
        "id": "2-2",
        "title": "土木施工の方法",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "ワイヤロープ及び補助具",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kisokenki": {
    "lessons": 8,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "基礎工事用建設機械の種類及び用途",
        "legal_min": 80
      },
      {
        "id": "1-2",
        "title": "原動機・動力伝達装置・作業装置",
        "legal_min": 55
      },
      {
        "id": "1-3",
        "title": "巻上げ装置とブレーキ",
        "legal_min": 55
      },
      {
        "id": "1-4",
        "title": "電気装置・警報装置・附属装置",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "運転に必要な力学及び土質工学",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "土木施工の方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "ワイヤロープ及び補助具",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kaitai": {
    "lessons": 10,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "原動機・動力伝達装置・走行装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "かじ取り装置とブレーキ",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "電気装置・警報装置と走行に関する附属装置",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "種類及び用途（ブレーカ・圧砕機・鉄骨切断機・つかみ機）",
        "legal_min": 45
      },
      {
        "id": "2-2",
        "title": "作業装置及び作業に関する附属装置の構造及び取扱いの方法",
        "legal_min": 50
      },
      {
        "id": "2-3",
        "title": "一般的作業方法（解体の進め方）",
        "legal_min": 55
      },
      {
        "id": "3-1",
        "title": "運転に必要な力学",
        "legal_min": 25
      },
      {
        "id": "3-2",
        "title": "コンクリート造、鉄骨造又は木造の工作物等の種類及び構造",
        "legal_min": 40
      },
      {
        "id": "3-3",
        "title": "建設施工の方法",
        "legal_min": 25
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kisokouji": {
    "lessons": 10,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "原動機・動力伝達装置・走行装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "操縦装置とブレーキ",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "電気装置・警報装置と走行に関する附属装置",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "種類及び用途（くい打機・アースドリル・アースオーガー等）",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "作業装置及び作業に関する附属装置の構造及び取扱い方法",
        "legal_min": 60
      },
      {
        "id": "2-3",
        "title": "一般的作業方法（据付けから施工・移動まで）",
        "legal_min": 70
      },
      {
        "id": "3-1",
        "title": "運転に必要な力学及び土質工学",
        "legal_min": 25
      },
      {
        "id": "3-2",
        "title": "土木施工の方法",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "ワイヤロープ及び補助具",
        "legal_min": 15
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kanikasen": {
    "lessons": 12,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "簡易架線集材装置の集材機の種類及び用途",
        "legal_min": 30
      },
      {
        "id": "1-2",
        "title": "架線集材機械の種類及び用途（スイングヤーダ等）",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "原動機・動力伝達装置・走行装置",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "操縦装置・制動装置・作業装置（ウインチ・ブーム）",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "油圧装置・電気装置・附属装置",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "簡易架線集材装置及び架線集材機械による集材の方法",
        "legal_min": 70
      },
      {
        "id": "3-2",
        "title": "簡易架線集材装置の索張りの方法",
        "legal_min": 50
      },
      {
        "id": "4-1",
        "title": "運転に必要な力学",
        "legal_min": 15
      },
      {
        "id": "4-2",
        "title": "電気に関する基礎知識",
        "legal_min": 10
      },
      {
        "id": "4-3",
        "title": "ワイヤロープの種類",
        "legal_min": 15
      },
      {
        "id": "4-4",
        "title": "ワイヤロープの止め方及び継ぎ方の種類",
        "legal_min": 20
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kikaishuzai": {
    "lessons": 6,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "集材機の種類、構造及び取扱いの方法",
        "legal_min": 70
      },
      {
        "id": "1-2",
        "title": "機械集材装置の索張り方式",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "集材方法",
        "legal_min": 50
      },
      {
        "id": "2-1",
        "title": "ワイヤロープの種類",
        "legal_min": 50
      },
      {
        "id": "2-2",
        "title": "ワイヤロープの止め方及び継ぎ方の種類",
        "legal_min": 70
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "soukou": {
    "lessons": 13,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "走行集材機械の種類（フォワーダ・集材車）",
        "legal_min": 35
      },
      {
        "id": "1-2",
        "title": "走行集材機械の用途と、隣の機械との区分",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "原動機・動力伝達装置・走行装置",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "操縦装置・制動装置・作業装置（荷台・グラップル・ウインチ）",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "油圧装置・電気装置・附属装置",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "作業の前（作業計画・作業道・点検・立入禁止の範囲）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "原木の積込み（グラップルとウインチ・積載量・重心）",
        "legal_min": 35
      },
      {
        "id": "3-3",
        "title": "原木の運搬（作業道の走行・傾斜・路肩・すれ違い）",
        "legal_min": 30
      },
      {
        "id": "3-4",
        "title": "荷下ろし・土場と、作業の終わり",
        "legal_min": 25
      },
      {
        "id": "4-1",
        "title": "走行集材機械の運転に必要な力学",
        "legal_min": 25
      },
      {
        "id": "4-2",
        "title": "電気に関する基礎知識",
        "legal_min": 15
      },
      {
        "id": "4-3",
        "title": "ワイヤロープの種類及び取扱いの方法",
        "legal_min": 20
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "batsuboku": {
    "lessons": 12,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "伐木等機械の種類（ハーベスタ・プロセッサ・フェラーバンチャ・グラップル）",
        "legal_min": 35
      },
      {
        "id": "1-2",
        "title": "伐木等機械の用途と、隣の機械との区分",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "原動機・動力伝達装置・走行装置",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "操縦装置・制動装置・作業装置",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "油圧装置・電気装置・附属装置",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "作業の前（作業計画・地形と地質・点検・立入禁止の範囲）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "伐木（機械による伐倒）",
        "legal_min": 35
      },
      {
        "id": "3-3",
        "title": "造材（枝払いと玉切り）",
        "legal_min": 25
      },
      {
        "id": "3-4",
        "title": "原木の集積と、作業の終わり",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "伐木等機械の運転に必要な力学",
        "legal_min": 35
      },
      {
        "id": "4-2",
        "title": "電気に関する基礎知識",
        "legal_min": 25
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "youka": {
    "lessons": 22,
    "requiredSec": 39600,
    "list": [
      {
        "id": "1-1",
        "title": "デリックブーム、デリックポスト、ガイその他の主要構造部分",
        "legal_min": 80
      },
      {
        "id": "1-2",
        "title": "巻上げ装置",
        "legal_min": 50
      },
      {
        "id": "1-3",
        "title": "制動装置",
        "legal_min": 40
      },
      {
        "id": "1-4",
        "title": "揚貨装置の機能及び取扱い方法",
        "legal_min": 70
      },
      {
        "id": "2-1",
        "title": "蒸気機関",
        "legal_min": 10
      },
      {
        "id": "2-2",
        "title": "内燃機関",
        "legal_min": 15
      },
      {
        "id": "2-3",
        "title": "電動機",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "電流、電圧及び抵抗",
        "legal_min": 20
      },
      {
        "id": "2-5",
        "title": "電力及び電力量",
        "legal_min": 15
      },
      {
        "id": "2-6",
        "title": "電力計、制御装置その他の揚貨装置に関する電気機械器具",
        "legal_min": 20
      },
      {
        "id": "2-7",
        "title": "感電による危険性",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 30
      },
      {
        "id": "3-2",
        "title": "重心",
        "legal_min": 20
      },
      {
        "id": "3-3",
        "title": "重量",
        "legal_min": 15
      },
      {
        "id": "3-4",
        "title": "速度",
        "legal_min": 15
      },
      {
        "id": "3-5",
        "title": "荷重（静荷重及び動荷重）",
        "legal_min": 25
      },
      {
        "id": "3-6",
        "title": "応力",
        "legal_min": 20
      },
      {
        "id": "3-7",
        "title": "材料の強さ",
        "legal_min": 20
      },
      {
        "id": "3-8",
        "title": "ワイヤロープ",
        "legal_min": 35
      },
      {
        "id": "3-9",
        "title": "フック及びスリングの強さ",
        "legal_min": 30
      },
      {
        "id": "3-10",
        "title": "ワイヤロープの掛け方と荷重との関係",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "press": {
    "lessons": 12,
    "requiredSec": 28800,
    "list": [
      {
        "id": "1-1",
        "title": "プレス機械の種類と構造（クラッチの種類が全ての元）",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "シヤーの種類と構造",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "安全装置と安全囲いの種類と構造",
        "legal_min": 35
      },
      {
        "id": "1-4",
        "title": "プレス機械・シヤー・安全装置の点検",
        "legal_min": 20
      },
      {
        "id": "2-1",
        "title": "材料の送給及び製品の取出し",
        "legal_min": 60
      },
      {
        "id": "2-2",
        "title": "金型、刃部、安全装置、安全囲いの異常及びその処理",
        "legal_min": 60
      },
      {
        "id": "3-1",
        "title": "金型の点検",
        "legal_min": 35
      },
      {
        "id": "3-2",
        "title": "金型の取付け",
        "legal_min": 50
      },
      {
        "id": "3-3",
        "title": "金型の取外し",
        "legal_min": 30
      },
      {
        "id": "3-4",
        "title": "調整（ダイハイト・ストローク・安全装置の合わせ直し）",
        "legal_min": 40
      },
      {
        "id": "3-5",
        "title": "シヤーの刃部の点検、取付け、取外し及び調整",
        "legal_min": 25
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "dioxin": {
    "lessons": 10,
    "requiredSec": 14400,
    "list": [
      {
        "id": "1-1",
        "title": "ダイオキシン類の性状",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "作業の手順",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "ダイオキシン類のばく露を低減させるための措置",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "作業環境改善の方法",
        "legal_min": 15
      },
      {
        "id": "2-4",
        "title": "洗身及び身体等の清潔の保持の方法",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "事故時の措置",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "ばく露を低減させるための設備の作業開始時の点検",
        "legal_min": 30
      },
      {
        "id": "4-1",
        "title": "保護具の種類、性能、洗浄方法、使用方法及び保守点検の方法",
        "legal_min": 60
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 18
      },
      {
        "id": "5-2",
        "title": "ばく露を防止するため当該業務について必要な事項",
        "legal_min": 12
      }
    ]
  },
  "zuidou": {
    "lessons": 14,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "掘削工法の概要",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "坑内における作業の種類",
        "legal_min": 25
      },
      {
        "id": "1-3",
        "title": "地質の種類及び性質",
        "legal_min": 25
      },
      {
        "id": "2-1",
        "title": "掘削設備",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "ずり積み設備",
        "legal_min": 20
      },
      {
        "id": "2-3",
        "title": "運搬設備",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "覆工設備",
        "legal_min": 20
      },
      {
        "id": "3-1",
        "title": "落盤又は肌落ちの防止のための措置",
        "legal_min": 45
      },
      {
        "id": "3-2",
        "title": "爆発又は火災の防止のための措置",
        "legal_min": 35
      },
      {
        "id": "3-3",
        "title": "工事用設備による労働災害の防止のための措置",
        "legal_min": 30
      },
      {
        "id": "3-4",
        "title": "作業環境改善の方法",
        "legal_min": 30
      },
      {
        "id": "3-5",
        "title": "事故発生時の措置",
        "legal_min": 25
      },
      {
        "id": "3-6",
        "title": "保護具の使用方法",
        "legal_min": 15
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "ev": {
    "lessons": 24,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "電気の危険性",
        "legal_min": 16
      },
      {
        "id": "1-2",
        "title": "短絡",
        "legal_min": 11
      },
      {
        "id": "1-3",
        "title": "漏電",
        "legal_min": 11
      },
      {
        "id": "1-4",
        "title": "接地",
        "legal_min": 11
      },
      {
        "id": "1-5",
        "title": "電気絶縁",
        "legal_min": 11
      },
      {
        "id": "2-1",
        "title": "自動車の仕組みと種類",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "コンバータ及びインバータ",
        "legal_min": 25
      },
      {
        "id": "2-3",
        "title": "配線",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "駆動用蓄電池及び充電器",
        "legal_min": 30
      },
      {
        "id": "2-5",
        "title": "駆動用原動機及び発電機",
        "legal_min": 20
      },
      {
        "id": "2-6",
        "title": "電気使用機器",
        "legal_min": 12
      },
      {
        "id": "2-7",
        "title": "保守及び点検",
        "legal_min": 13
      },
      {
        "id": "3-1",
        "title": "絶縁用保護具・絶縁用防具・絶縁工具及び絶縁テープ",
        "legal_min": 12
      },
      {
        "id": "3-2",
        "title": "検電器",
        "legal_min": 8
      },
      {
        "id": "3-3",
        "title": "その他の安全作業用具",
        "legal_min": 5
      },
      {
        "id": "3-4",
        "title": "管理",
        "legal_min": 5
      },
      {
        "id": "4-1",
        "title": "充電電路の防護",
        "legal_min": 10
      },
      {
        "id": "4-2",
        "title": "作業者の絶縁保護",
        "legal_min": 10
      },
      {
        "id": "4-3",
        "title": "停電の方法",
        "legal_min": 10
      },
      {
        "id": "4-4",
        "title": "停電電路に対する措置",
        "legal_min": 10
      },
      {
        "id": "4-5",
        "title": "作業管理",
        "legal_min": 8
      },
      {
        "id": "4-6",
        "title": "救急処置",
        "legal_min": 7
      },
      {
        "id": "4-7",
        "title": "災害防止",
        "legal_min": 5
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kouatsu": {
    "lessons": 32,
    "requiredSec": 39600,
    "list": [
      {
        "id": "1-1",
        "title": "高圧又は特別高圧の電気の危険性",
        "legal_min": 20
      },
      {
        "id": "1-2",
        "title": "接近限界距離",
        "legal_min": 15
      },
      {
        "id": "1-3",
        "title": "短絡",
        "legal_min": 12
      },
      {
        "id": "1-4",
        "title": "漏電",
        "legal_min": 11
      },
      {
        "id": "1-5",
        "title": "接地",
        "legal_min": 12
      },
      {
        "id": "1-6",
        "title": "静電誘導",
        "legal_min": 10
      },
      {
        "id": "1-7",
        "title": "電気絶縁",
        "legal_min": 10
      },
      {
        "id": "2-1",
        "title": "発電設備",
        "legal_min": 15
      },
      {
        "id": "2-2",
        "title": "送電設備",
        "legal_min": 15
      },
      {
        "id": "2-3",
        "title": "配電設備",
        "legal_min": 20
      },
      {
        "id": "2-4",
        "title": "変電設備",
        "legal_min": 15
      },
      {
        "id": "2-5",
        "title": "受電設備",
        "legal_min": 25
      },
      {
        "id": "2-6",
        "title": "電気使用設備",
        "legal_min": 15
      },
      {
        "id": "2-7",
        "title": "保守及び点検",
        "legal_min": 15
      },
      {
        "id": "3-1",
        "title": "絶縁用保護具",
        "legal_min": 15
      },
      {
        "id": "3-2",
        "title": "絶縁用防具",
        "legal_min": 12
      },
      {
        "id": "3-3",
        "title": "活線作業用器具",
        "legal_min": 12
      },
      {
        "id": "3-4",
        "title": "活線作業用装置",
        "legal_min": 12
      },
      {
        "id": "3-5",
        "title": "検電器",
        "legal_min": 12
      },
      {
        "id": "3-6",
        "title": "短絡接地器具",
        "legal_min": 12
      },
      {
        "id": "3-7",
        "title": "その他の安全作業用具",
        "legal_min": 8
      },
      {
        "id": "3-8",
        "title": "管理",
        "legal_min": 7
      },
      {
        "id": "4-1",
        "title": "充電電路の防護",
        "legal_min": 40
      },
      {
        "id": "4-2",
        "title": "作業者の絶縁保護",
        "legal_min": 40
      },
      {
        "id": "4-3",
        "title": "活線作業用器具及び活線作業用装置の取扱い",
        "legal_min": 40
      },
      {
        "id": "4-4",
        "title": "安全距離の確保",
        "legal_min": 35
      },
      {
        "id": "4-5",
        "title": "停電電路に対する措置",
        "legal_min": 45
      },
      {
        "id": "4-6",
        "title": "開閉装置の操作",
        "legal_min": 30
      },
      {
        "id": "4-7",
        "title": "作業管理",
        "legal_min": 25
      },
      {
        "id": "4-8",
        "title": "救急処置",
        "legal_min": 25
      },
      {
        "id": "4-9",
        "title": "災害防止",
        "legal_min": 20
      },
      {
        "id": "5-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "fuseichi": {
    "lessons": 12,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "種類（クローラ式・ホイール式）と、原動機・動力伝達装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "走行装置（クローラ）・操縦装置・制動装置",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "電気装置・警報装置と、走行に関する附属装置の取扱いの方法",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "荷役装置（ダンプ装置・あおり）と油圧装置",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "荷の積卸しの方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "荷の運搬の方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 15
      },
      {
        "id": "3-2",
        "title": "重量",
        "legal_min": 10
      },
      {
        "id": "3-3",
        "title": "重心及び物の安定",
        "legal_min": 15
      },
      {
        "id": "3-4",
        "title": "速度及び加速度",
        "legal_min": 10
      },
      {
        "id": "3-5",
        "title": "荷重",
        "legal_min": 10
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "shovel": {
    "lessons": 14,
    "requiredSec": 21600,
    "list": [
      {
        "id": "1-1",
        "title": "種類（ショベルとフォーク）と、原動機・動力伝達装置",
        "legal_min": 40
      },
      {
        "id": "1-2",
        "title": "走行装置・操縦装置（中折れ）・制動装置",
        "legal_min": 40
      },
      {
        "id": "1-3",
        "title": "電気装置・警報装置と、走行に関する附属装置の取扱い方法",
        "legal_min": 40
      },
      {
        "id": "2-1",
        "title": "荷役装置（バケット・フォーク・リフトアーム）",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "油圧装置",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "ヘッドガードと、荷役に関する附属装置の取扱い方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "力（合成、分解、つり合い及びモーメント）",
        "legal_min": 10
      },
      {
        "id": "3-2",
        "title": "重量",
        "legal_min": 7
      },
      {
        "id": "3-3",
        "title": "重心及び物の安定",
        "legal_min": 12
      },
      {
        "id": "3-4",
        "title": "速度及び加速度",
        "legal_min": 8
      },
      {
        "id": "3-5",
        "title": "荷重",
        "legal_min": 8
      },
      {
        "id": "3-6",
        "title": "応力",
        "legal_min": 7
      },
      {
        "id": "3-7",
        "title": "材料の強さ",
        "legal_min": 8
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kikaitoishi": {
    "lessons": 12,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "研削盤の種類及び構造並びにその取扱い方法",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "といしの種類、構成、表示及び安全度並びにその取扱い方法",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "取付け具",
        "legal_min": 30
      },
      {
        "id": "1-4",
        "title": "覆い",
        "legal_min": 30
      },
      {
        "id": "1-5",
        "title": "保護具",
        "legal_min": 30
      },
      {
        "id": "1-6",
        "title": "研削液",
        "legal_min": 30
      },
      {
        "id": "2-1",
        "title": "研削盤とといしとの適合確認",
        "legal_min": 20
      },
      {
        "id": "2-2",
        "title": "といしの外観検査及び打音検査",
        "legal_min": 30
      },
      {
        "id": "2-3",
        "title": "取付け具の締付け方法及び締付け力",
        "legal_min": 25
      },
      {
        "id": "2-4",
        "title": "バランスの取り方",
        "legal_min": 20
      },
      {
        "id": "2-5",
        "title": "試運転の方法",
        "legal_min": 25
      },
      {
        "id": "3-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "kogata": {
    "lessons": 9,
    "requiredSec": 25200,
    "list": [
      {
        "id": "1-1",
        "title": "原動機と動力伝達装置",
        "legal_min": 60
      },
      {
        "id": "1-2",
        "title": "走行装置と操縦装置",
        "legal_min": 60
      },
      {
        "id": "1-3",
        "title": "ブレーキ・電気装置・警報装置と走行に関する附属装置",
        "legal_min": 60
      },
      {
        "id": "2-1",
        "title": "種類及び用途",
        "legal_min": 40
      },
      {
        "id": "2-2",
        "title": "作業装置及び作業に関する附属装置の構造及び取扱い方法",
        "legal_min": 40
      },
      {
        "id": "2-3",
        "title": "一般的作業方法",
        "legal_min": 40
      },
      {
        "id": "3-1",
        "title": "運転に必要な力学及び土質工学",
        "legal_min": 35
      },
      {
        "id": "3-2",
        "title": "土木施工の方法",
        "legal_min": 25
      },
      {
        "id": "4-1",
        "title": "法、令及び安衛則中の関係条項",
        "legal_min": 60
      }
    ]
  },
  "sanketsu": {
    "lessons": 13,
    "requiredSec": 19800,
    "list": [
      {
        "id": "1-1",
        "title": "酸素欠乏の発生の原因",
        "legal_min": 25
      },
      {
        "id": "1-2",
        "title": "硫化水素の発生の原因",
        "legal_min": 20
      },
      {
        "id": "1-3",
        "title": "酸素欠乏等の発生しやすい場所",
        "legal_min": 15
      },
      {
        "id": "2-1",
        "title": "酸素欠乏等による危険性",
        "legal_min": 30
      },
      {
        "id": "2-2",
        "title": "酸素欠乏症等の主な症状",
        "legal_min": 30
      },
      {
        "id": "3-1",
        "title": "空気呼吸器、酸素呼吸器、送気マスク及び換気装置の種類",
        "legal_min": 25
      },
      {
        "id": "3-2",
        "title": "使用方法及び保守点検の方法",
        "legal_min": 35
      },
      {
        "id": "4-1",
        "title": "退避と、墜落制止用器具等・救出用の設備及び器具の使用方法及び保守点検の方法",
        "legal_min": 25
      },
      {
        "id": "4-2",
        "title": "人工呼吸の方法",
        "legal_min": 25
      },
      {
        "id": "4-3",
        "title": "人工そ生器の使用方法",
        "legal_min": 10
      },
      {
        "id": "5-1",
        "title": "酸素及び硫化水素の濃度の測定の方法",
        "legal_min": 30
      },
      {
        "id": "5-2",
        "title": "換気の方法と作業の進め方",
        "legal_min": 25
      },
      {
        "id": "5-3",
        "title": "法、令、安衛則及び酸欠則中の関係条項",
        "legal_min": 35
      }
    ]
  }
};

/** その講座の単元の数と学科の時間。知らない講座なら 0 */
export const statOf = (courseId: string): LessonStat =>
  LESSON_STATS[courseId] ?? { lessons: 0, requiredSec: 0, list: [] };
