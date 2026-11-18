// data/foodSafety.js —— 由 scripts/build-food-safety.js 生成，请勿手改
// 源：knowledge/food-safety/inspections.csv（717 行）、penalties.csv（14 行）
module.exports = {
  "version": "fs-2026-11-18",
  "scope": {
    "region": "广东省",
    "from": "2026-01",
    "to": "2026-11",
    "organ": "广东省市场监督管理局",
    "inspectedNote": "只统计通告里的不合格批次，不含合格批次总量，因此不计算「合格率」。",
    "penaltyNote": "处罚数据为决定书机器抽取，原文标注「待核验」。"
  },
  "inspections": {
    "batches": 717,
    "notices": 42,
    "months": [
      {
        "label": "1月",
        "n": 127,
        "h": 100
      },
      {
        "label": "2月",
        "n": 52,
        "h": 41
      },
      {
        "label": "3月",
        "n": 69,
        "h": 54
      },
      {
        "label": "4月",
        "n": 77,
        "h": 61
      },
      {
        "label": "5月",
        "n": 46,
        "h": 36
      },
      {
        "label": "6月",
        "n": 99,
        "h": 78
      },
      {
        "label": "7月",
        "n": 81,
        "h": 64
      },
      {
        "label": "8月",
        "n": 50,
        "h": 39
      },
      {
        "label": "9月",
        "n": 68,
        "h": 54
      },
      {
        "label": "10月",
        "n": 32,
        "h": 25
      },
      {
        "label": "11月",
        "n": 16,
        "h": 13
      }
    ],
    "problems": [
      {
        "key": "p0",
        "name": "微生物污染",
        "n": 338,
        "pct": 47.1,
        "w": 100
      },
      {
        "key": "p1",
        "name": "食品添加剂超范围超限量使用",
        "n": 145,
        "pct": 20.2,
        "w": 43
      },
      {
        "key": "p2",
        "name": "其他指标",
        "n": 134,
        "pct": 18.7,
        "w": 40
      },
      {
        "key": "p3",
        "name": "农兽药残留",
        "n": 70,
        "pct": 9.8,
        "w": 21
      },
      {
        "key": "p4",
        "name": "重金属污染",
        "n": 22,
        "pct": 3.1,
        "w": 7
      },
      {
        "key": "p5",
        "name": "兽药残留",
        "n": 4,
        "pct": 0.6,
        "w": 1
      },
      {
        "key": "p6",
        "name": "质量指标",
        "n": 4,
        "pct": 0.6,
        "w": 1
      }
    ],
    "stages": [
      {
        "key": "s0",
        "name": "流通",
        "n": 526,
        "pct": 73.4
      },
      {
        "key": "s1",
        "name": "餐饮",
        "n": 185,
        "pct": 25.8
      },
      {
        "key": "s2",
        "name": "生产",
        "n": 6,
        "pct": 0.8
      }
    ],
    "ingredients": [
      {
        "name": "鸡肉",
        "n": 82
      },
      {
        "name": "青橄榄",
        "n": 69
      },
      {
        "name": "面粉",
        "n": 51
      },
      {
        "name": "大米",
        "n": 29
      },
      {
        "name": "鸡蛋",
        "n": 19
      },
      {
        "name": "甘草",
        "n": 14
      },
      {
        "name": "生姜",
        "n": 11
      },
      {
        "name": "牛肉",
        "n": 10
      }
    ],
    "tagged": 404,
    "unmatched": 313,
    "latest": [
      {
        "no": "2026年第131号",
        "date": "11/04",
        "title": "16批次食品不合格情况的通告（2026年第47期）",
        "declared": 16,
        "count": 16
      },
      {
        "no": "2026年第128号",
        "date": "10/16",
        "title": "18批次食品不合格情况的通告（2026年第46期）",
        "declared": 18,
        "count": 16
      },
      {
        "no": "2026年第125号",
        "date": "10/08",
        "title": "17批次食品不合格情况的通告（2026年第45期）",
        "declared": 17,
        "count": 16
      }
    ]
  },
  "penalties": {
    "total": 14,
    "food": 3,
    "other": 10,
    "pending": 1,
    "amount": 396427.6,
    "amountWan": 39.6,
    "amountMax": 296427.6,
    "amountMaxWan": 29.6,
    "cases": [
      {
        "doc": "粤市监处罚〔2026〕20号",
        "date": "2026-09-24",
        "cause": "直播宣称「无添加剂」，与配料表不符",
        "basis": "《反不正当竞争法》第九条第一款",
        "tag": "虚假宣传",
        "amount": 100000,
        "action": "罚款 100,000 元"
      },
      {
        "doc": "粤市监处罚〔2026〕6号",
        "date": "2026-05-06",
        "cause": "检验检测机构出具不实检验报告",
        "basis": "《检验检测机构监督管理办法》第十四条",
        "tag": "检验机构",
        "amount": 0,
        "action": "通报（决定书未列罚款金额）"
      },
      {
        "doc": "粤市监罚〔2026〕广州办0423号",
        "date": "2026-04-24",
        "cause": "生产经营标注虚假生产日期的食品",
        "basis": "《食品安全法》第三十四条第（十）项",
        "tag": "标签日期",
        "amount": 296427.6,
        "action": "罚款 296,427.6 元"
      }
    ]
  }
};
