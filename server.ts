import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // AI-powered deep error diagnostics endpoint
  app.post("/api/diagnose", async (req, res) => {
    try {
      const { command, errorName, errorCode, exitCode, message, snippet, stack, context } = req.body;
      const ai = getGeminiClient();

      if (!ai) {
        // Deterministic local smart analysis fallback if no API key is set
        return res.json({
          source: "local-rules",
          summary: `The command \`${command || "faultline"}\` failed with code ${errorCode || "ERR_GENERAL"} (Exit: ${exitCode || 1}).`,
          rootCause: message || "An unexpected execution fault occurred during CLI operation.",
          suggestedFixes: [
            "Verify configuration parameters and syntax in target files.",
            "Ensure appropriate POSIX permissions (e.g., chmod u+rw) exist for target paths.",
            "Run with `--dry-run` or `--verbose` to trace input arguments.",
          ],
          safeRollbackDone: true,
          posixStandardRef: `Exit code ${exitCode || 1} standard POSIX specification.`,
        });
      }

      const prompt = `You are an expert systems & CLI reliability engineer.
A command line tool executed by the user failed. Analyze the following failure context and provide a structured JSON diagnosis with actionable remediation.

Command: ${command || "faultline"}
Error Type: ${errorName || "FaultlineError"}
Error Code: ${errorCode || "ERR_GENERAL"}
Exit Code: ${exitCode || 1}
Message: ${message || "Unknown error"}
Code Snippet / Context: ${snippet || "N/A"}
Stack / State: ${stack || "N/A"}
Extra Context: ${JSON.stringify(context || {})}

Return a valid JSON object matching:
{
  "summary": "1-2 sentence high-level summary of what broke",
  "rootCause": "Clear explanation of why this happened",
  "suggestedFixes": ["Specific CLI command or action 1", "Specific action 2"],
  "patchSnippet": "optional shell snippet or code fix diff",
  "posixStandardRef": "Explanation of POSIX exit code meaning",
  "preventativeAdvice": "How to prevent this in CI/CD or production"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      let parsed = {};
      try {
        parsed = JSON.parse(responseText);
      } catch {
        parsed = {
          summary: "Analysis complete.",
          rootCause: responseText,
          suggestedFixes: ["Inspect tool flags and environment settings."],
        };
      }

      res.json({
        source: "gemini-ai",
        ...parsed,
      });
    } catch (err: any) {
      console.error("AI diagnosis error:", err);
      res.status(500).json({
        error: "Failed to generate AI diagnosis",
        details: err?.message || String(err),
      });
    }
  });

  // Simulated telemetry reporting endpoint for failed CLI runs
  app.post("/api/telemetry", (req, res) => {
    const { traceId, errorCode, exitCode, durationMs } = req.body;
    console.log(`[CLI Telemetry] Recorded event ${traceId}: ${errorCode} (exit ${exitCode}) in ${durationMs}ms`);
    res.json({ recorded: true, traceId, serverTime: new Date().toISOString() });
  });

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Faultline CLI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
