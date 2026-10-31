# 全球鮪類資源查詢（Global tuna fisheries）

線上版：https://juliah1121.github.io/Global_tuna_fisheries/

五個鮪類區域漁業管理組織（IATTC、ICCAT、IOTC、WCPFC、CCSBT）的互動查詢網頁：

- **總覽**：各組織逐年漁獲、CMSY++ 最終年 Kobe 總覽與分區統計。
- **漁獲查詢**：依組織、物種類別、物種、國家、漁法篩選，逐年堆疊圖與年度排行。
- **配額**：各組織措施附表中的國別配額／漁獲上限，與實際漁獲、使用率對照，附原始文件連結。
- **CMSY 結果**：76 個洋區系群的 CMSY++（只用漁獲）結果與 Kobe 圖。
- **系群詳細**：參數、B/Bmsy 與 F/Fmsy 時序、Kobe 軌跡與後驗點雲、國家別漁獲、ISSF 對照。
- **與 ISSF 比較**：ISSF 2026-01 報告 23 個主要鮪類系群的正式評估與 CMSY++ 對照。

## 檔案

| 檔案 | 內容 |
|---|---|
| `index.html` | 頁面與樣式 |
| `dash-shim.js` | 資料載入與頁面狀態（讀取 `data/` 的 CSV） |
| `core.js`、`*page.js`、`overview.js`、`detail.js` | 各頁繪圖與互動 |
| `data/catch.csv` | 年度漁獲（公噸），依組織、物種（FAO 3 碼）、國家（ISO 3 碼）、統一漁法彙總 |
| `data/quota.csv` | 國別配額／上限、對照漁獲、使用率、出處 |
| `data/cmsy_results.csv`、`data/cmsy_ts.csv`、`data/kobe_cloud.csv` | CMSY++ 結果、時間序列、最終年後驗抽樣 |
| `data/issf_compare.csv` | CMSY++ 與 ISSF 對照 |
| `data/species.csv`、`data/countries.csv`、`data/gears.csv` | 代碼對照 |

純靜態網站，只需從 cdnjs 載入 d3 v7.9.0；在本機用任何靜態伺服器開啟即可（例如 `python3 -m http.server`）。

## 注意

CMSY++ 為只用漁獲資料的研究性分析，B/Bmsy 主要由先驗決定，且 Schaefer 模型的 Bmsy 定義與鮪類正式評估不同，不能取代 RFMO 的正式資源評估。配額使用率因轉讓、結轉、船隊歸屬與漁獲類型範圍不一，僅供參考。
