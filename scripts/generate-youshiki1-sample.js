import { writeYoushiki1Docx } from "../src/documents/youshiki1.js";

await writeYoushiki1Docx(
  {
    applicationDate: "2026-09-11",
    prefecture: "東京都",
    licenseType: "一般",
    applicantName: "サンプル建設株式会社",
    representativeName: "山田 太郎",
    address: "東京都千代田区霞が関1-1-1",
    constructionTypes: ["建築工事業", "電気工事業"],
  },
  "out/youshiki1-sample.docx"
);

console.log("wrote out/youshiki1-sample.docx");
