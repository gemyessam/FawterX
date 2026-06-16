const fs = require('fs');
let c = fs.readFileSync('backend/src/routes/excel.js', 'utf8');

const target1 = `  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};`;

const replacement1 = `  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const uploadBatchMiddleware = (req, res, next) => {
  try {
    upload.array("files", 50)(req, res, (err) => {
      if (err) {
        console.error("=== SERVER ERROR ===", err);
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};`;

const target2 = `  }
});

// ——— POST /api/excel/parse ———`;

const replacement2 = `  }
});

// ——— POST /api/excel/upload-batch ———
router.post("/upload-batch", uploadBatchMiddleware, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "لم يتم رفع أي ملفات" });
    }

    const mode = req.body.mode || req.query.mode || "template";
    console.log(\`[Batch Upload] Mode: \${mode}, Files count: \${req.files.length}\`);

    const results = await Promise.all(
      req.files.map(async (file) => {
        try {
          const ext = path.extname(file.originalname).toLowerCase();
          const isPdf = ext === ".pdf";
          let result;

          if (isPdf || mode === "smart") {
            result = await parseSmartDocument(file.path, isPdf);
          } else {
            result = parseExcel(file.path);
          }

          const { headers, rows, sheetName, parserDebugInfo, metadata, invoiceLines, totals, warnings, confidenceScore } = result;
          
          return {
            success: true,
            filePath: file.path,
            fileName: file.originalname,
            sheetName: sheetName || "Sheet1",
            headers,
            totalRows: rows.length,
            preview: rows.slice(0, 10),
            rows,
            invoiceLines: invoiceLines || rows,
            totals: totals || {},
            warnings: warnings || parserDebugInfo?.parsingWarnings || [],
            confidenceScore: confidenceScore || parserDebugInfo?.confidenceScore || 0,
            parserDebugInfo,
            metadata,
          };
        } catch (fileErr) {
          console.error(\`[Batch Upload] Error parsing file \${file.originalname}:\`, fileErr);
          return {
            success: false,
            fileName: file.originalname,
            message: fileErr.message
          };
        }
      })
    );

    return res.json({ success: true, results });
  } catch (err) {
    console.error("=== SERVER ERROR ===", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ——— POST /api/excel/parse ———`;

// Standardize line endings to try replacing
c = c.replace(/\r\n/g, '\n');
c = c.replace(target1.replace(/\r\n/g, '\n'), replacement1);
c = c.replace(target2.replace(/\r\n/g, '\n'), replacement2);

fs.writeFileSync('backend/src/routes/excel.js', c);
console.log("Updated excel.js");
