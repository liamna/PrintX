import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Resend } from 'resend';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post('/api/quote', async (req, res) => {
    try {
      const { modelUrl } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `I have a user requesting a 3D print quote.
Here is the URL or file they submitted: ${modelUrl}
Please estimate a reasonable realistic base cost in USD for purchasing this model file online. If it's a popular free site like Thingiverse or MakerWorld, cost is 0.
Return ONLY a valid JSON object matching this schema:
{
  "modelCost": number (estimated cost of the model itself in USD),
  "modelName": string (a plausible name for the model based on URL),
  "materialCost": number (estimated material cost for printing, around 3-10 USD),
  "printTimeHours": number (estimate, eg 1-5)
}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              modelCost: { type: Type.NUMBER },
              modelName: { type: Type.STRING },
              materialCost: { type: Type.NUMBER },
              printTimeHours: { type: Type.NUMBER }
            },
            required: ["modelCost", "modelName", "materialCost", "printTimeHours"]
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      const modelCost = parsed.modelCost || 0;
      const materialCost = parsed.materialCost || 6;
      
      const profitMargin = 4;
      const itemTotal = modelCost + materialCost + profitMargin;

      res.json({
        modelCost,
        modelName: parsed.modelName || "Custom 3D Model",
        materialCost,
        profitMargin,
        itemTotal,
        printTimeHours: parsed.printTimeHours || 2
      });
    } catch (error: any) {
      console.error("Quote API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate quote" });
    }
  });

  app.post('/api/send-email', async (req, res) => {
    try {
      const { customer, cart, total } = req.body;
      const apiKey = process.env.RESEND_API_KEY;
      
      if (!apiKey) {
        console.log("RESEND_API_KEY not defined, simulating email send.");
        return res.json({ success: true, message: "Order processed (simulated email)" });
      }

      const resend = new Resend(apiKey);

      const itemsList = cart.map((i: any) => `- ${i.modelName} (Qty: ${i.quantity}): $${(i.itemTotal * i.quantity).toFixed(2)}`).join('\n');
      
      const emailContent = `
New Order Received!

Customer Details:
Email: ${customer.email}
Address: ${customer.address}, ${customer.city}, ${customer.country}

Items:
${itemsList}

Total Cost: $${total.toFixed(2)}
      `.trim();

      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'liameilat2200@gmail.com',
        subject: 'New 3D Print Order Received!',
        text: emailContent,
      });

      if (error) {
        console.warn(`Resend API Warning: ${error.name} - ${error.message}`);
        return res.status(500).json({ error: "Failed to send email", details: error });
      }

      res.json({ success: true, message: "Order processed and email sent" });
    } catch (error: any) {
      console.error("Email API Error:", error);
      res.status(500).json({ error: error.message || "Failed to process email" });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
