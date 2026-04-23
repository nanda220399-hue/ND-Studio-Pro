import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from 'cloudinary';
import os from "os";

// Configure Cloudinary (Prefer Env Vars if available)
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwpoqmll1', 
  api_key: process.env.CLOUDINARY_API_KEY || '417135212776651', 
  api_secret: process.env.CLOUDINARY_API_SECRET || 'x9wjOixxcA2QxxDqKZK0ii_M2tk' 
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX: Use /tmp for Vercel compatibility
const uploadsDir = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.error("Gagal membuat folder upload:", err);
  }
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Log all requests
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  
  // Serve uploads publicly with CORS enabled
  app.use('/uploads', (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(uploadsDir));

  // Endpoint to handle file uploads and return public URL
  app.get("/api/upload", (req, res) => {
    // Set a cookie that works cross-site to help bypass browser security blocks
    res.setHeader('Set-Cookie', 'nd_studio_auth=true; Path=/; SameSite=None; Secure; Max-Age=3600');
    
    res.send(`
      <html>
        <head>
          <title>ND STUDIO AI - Authenticate</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8f9fa;">
          <div style="background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%;">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h2 style="color: #0d6832; margin-bottom: 16px;">Autentikasi Berhasil</h2>
            <p style="color: #495057; margin-bottom: 24px; line-height: 1.5;">Koneksi aman telah terjalin. Browser Anda sekarang mengizinkan aplikasi untuk mengunggah file.</p>
            <div style="background: #e7fcf3; border: 1px solid #b7f2d7; color: #0d6832; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 24px;">
              <strong>Langkah selanjutnya:</strong> Tutup jendela ini dan coba upload kembali di aplikasi.
            </div>
            <button onclick="window.close()" style="background: #5d5fef; color: white; border: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; font-size: 16px;">Tutup Jendela & Kembali</button>
          </div>
          <script>
            // Try to notify the opener if possible
            if (window.opener) {
              try {
                window.opener.postMessage('auth_complete', '*');
              } catch (e) {}
            }
          </script>
        </body>
      </html>
    `);
  });

  app.post("/api/upload", (req, res, next) => {
    console.log("Hit /api/upload route");
    if (req.is('application/json')) {
      next();
    } else {
      upload.single('file')(req, res, (err) => {
        if (err) {
          console.error("Multer error:", err);
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(413).json({ message: "File terlalu besar. Maksimal 50MB." });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
          }
          return res.status(500).json({ message: `Unknown upload error: ${err.message}` });
        }
        next();
      });
    }
  }, async (req, res) => {
    let fileBuffer: Buffer;
    let originalname: string;
    let mimetype: string;
    let filename: string;

    if (req.is('application/json')) {
      const { file, name, type } = req.body;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      const base64Data = file.split(';base64,').pop();
      fileBuffer = Buffer.from(base64Data, 'base64');
      originalname = name || 'upload.bin';
      mimetype = type || 'application/octet-stream';
      filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(originalname);
      // Save to disk for fallback
      fs.writeFileSync(path.join(uploadsDir, filename), fileBuffer);
    } else {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      fileBuffer = fs.readFileSync(req.file.path);
      originalname = req.file.originalname;
      mimetype = req.file.mimetype;
      filename = req.file.filename;
    }
    
    try {
      const blob = new Blob([fileBuffer], { type: mimetype });
      let publicUrl = '';

      try {
        // Primary Upload: Cloudinary
        console.log(`Uploading to Cloudinary: ${originalname} (${fileBuffer.length} bytes)`);
        
        const uploadPromise = new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'nd_studio_pro', resource_type: 'auto' },
            (error, result) => {
              if (error) reject(error);
              else if (result && result.secure_url) resolve(result.secure_url);
              else reject(new Error("Invalid Cloudinary response"));
            }
          );
          
          uploadStream.on('error', (err) => {
            console.error("Cloudinary stream error:", err);
            reject(err);
          });
          
          uploadStream.end(fileBuffer);
        });

        publicUrl = await uploadPromise;
      } catch (cloudinaryErr: any) {
        console.error("Cloudinary failed:", cloudinaryErr.message);
        
        // Secondary Upload: tmpfiles.org
        try {
          const formData = new FormData();
          formData.append('file', blob, originalname);

          console.log(`Fallback uploading to tmpfiles.org...`);
          const uploadRes = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (uploadRes.data && uploadRes.data.status === 'success' && uploadRes.data.data && uploadRes.data.data.url) {
            publicUrl = uploadRes.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          } else {
            throw new Error("Invalid tmpfiles response");
          }
        } catch (tmpErr: any) {
          console.error("tmpfiles.org failed:", tmpErr.message);
          
          // Third Fallback: pomf2.lain.la
          try {
            const formData = new FormData();
            formData.append('files[]', blob, originalname);

            console.log(`Third fallback uploading to pomf2.lain.la...`);
            const uploadRes = await axios.post('https://pomf2.lain.la/upload.php', formData, {
              headers: { 
                'Content-Type': 'multipart/form-data',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });

            if (uploadRes.data && uploadRes.data.success && uploadRes.data.files && uploadRes.data.files[0]) {
              publicUrl = uploadRes.data.files[0].url;
            } else {
              throw new Error("Invalid pomf2 response");
            }
          } catch (pomfErr: any) {
            console.error("pomf2.lain.la failed:", pomfErr.message);
            
            // Fourth Fallback: uguu.se
            try {
              const formData = new FormData();
              formData.append('files[]', blob, originalname);

              console.log(`Fourth fallback uploading to uguu.se...`);
              const uploadRes = await axios.post('https://uguu.se/upload.php', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });

              if (uploadRes.data && uploadRes.data.success && uploadRes.data.files && uploadRes.data.files[0]) {
                publicUrl = uploadRes.data.files[0].url;
              } else {
                throw new Error("Invalid uguu.se response");
              }
            } catch (uguuErr: any) {
              console.error("uguu.se failed:", uguuErr.message);
              
              // Final Fallback: catbox.moe
              try {
                const formData = new FormData();
                formData.append('reqtype', 'fileupload');
                formData.append('fileToUpload', blob, originalname);

                console.log(`Final fallback uploading to catbox.moe...`);
                const uploadRes = await axios.post('https://catbox.moe/user/api.php', formData, {
                  headers: { 
                    'Content-Type': 'multipart/form-data',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  }
                });

                const responseData = typeof uploadRes.data === 'string' ? uploadRes.data.trim() : String(uploadRes.data).trim();
                if (responseData.startsWith('http')) {
                  publicUrl = responseData;
                } else {
                  throw new Error(`Invalid catbox response: ${responseData}`);
                }
              } catch (catboxErr: any) {
                console.error("catbox.moe failed:", catboxErr.message);
                throw new Error("All public upload providers failed");
              }
            }
          }
        }
      }

      if (publicUrl) {
        // Force HTTPS as Freepik strictly requires it
        if (publicUrl.startsWith('//')) {
          publicUrl = 'https:' + publicUrl;
        } else if (publicUrl.startsWith('http://')) {
          publicUrl = publicUrl.replace('http://', 'https://');
        }
        console.log(`File uploaded to public storage: ${publicUrl}`);
        
        // Clean up local file
        fs.unlinkSync(path.join(uploadsDir, filename));
        
        res.json({ url: publicUrl });
      } else {
        throw new Error("All public upload providers failed");
      }
    } catch (error: any) {
      console.error("Public upload error:", error.message);
      // Fallback to local URL if public upload fails
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const localUrl = `https://${host}/uploads/${filename}`;
      console.log(`Fallback to local URL: ${localUrl}`);
      res.json({ url: localUrl });
    }
  });

  // Endpoint to clear Cloudinary folder (Admin only)
  app.post("/api/admin/clear-cloudinary", async (req, res) => {
    try {
      // In a real app, verify admin token here. For now, just execute.
      console.log("Clearing Cloudinary folder: nd_studio_pro (Images & Videos)");
      
      // Delete images and videos in parallel
      const [imageResult, videoResult] = await Promise.all([
        cloudinary.api.delete_resources_by_prefix('nd_studio_pro/', { resource_type: 'image' }),
        cloudinary.api.delete_resources_by_prefix('nd_studio_pro/', { resource_type: 'video' })
      ]);

      res.json({ 
        success: true, 
        message: "Berhasil menghapus semua gambar dan video di Cloudinary.", 
        results: { imageResult, videoResult } 
      });
    } catch (error: any) {
      console.error("Cloudinary clear error:", error);
      res.status(500).json({ success: false, message: error.message || "Gagal menghapus file di Cloudinary." });
    }
  });

  // Endpoint to translate prompt to English using free Google Translate API
  app.post("/api/translate", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      // Use free Google Translate endpoint (no API key required)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const response = await axios.get(url);
      
      // The response format is: [[["translated text","original text",null,null,1]],null,"id",null,null,null,1,[]]
      let translatedText = text;
      if (response.data && response.data[0]) {
        translatedText = response.data[0].map((item: any) => item[0]).join('');
      }

      res.json({ translatedText });
    } catch (error: any) {
      console.error("Translation error:", error.message);
      // Fallback to original text if translation fails
      res.json({ translatedText: req.body.text });
    }
  });

  // Proxy for Freepik API to avoid CORS issues
  app.post("/api/freepik/generate", async (req, res) => {
    const { endpoint, apiKey, body } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      console.error("Proxy Error: Invalid or missing API Key in POST request");
      return res.status(401).json({ message: "Unauthorized: API key is missing or invalid." });
    }

    const cleanKey = apiKey.trim();
    console.log(`Proxying POST to ${endpoint}. Key length: ${cleanKey.length}`);
    console.log(`Proxy POST Body:`, JSON.stringify(body, null, 2));
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'x-freepik-api-key': cleanKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(body)
      });

      const contentType = response.headers.get("content-type");
      console.log(`Proxy POST Response Status: ${response.status} (${response.statusText})`);
      console.log(`Proxy POST Content-Type: ${contentType}`);

      const text = await response.text();
      let data;
      if (contentType && contentType.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { message: text };
        }
      } else {
        data = { message: text };
      }

      if (!response.ok) {
        console.error(`Freepik API Error (${response.status}) POST to ${endpoint}:`, JSON.stringify(data, null, 2));
      } else {
        console.log(`Freepik API Success POST to ${endpoint}`);
        console.log(`Freepik API Response Data:`, JSON.stringify(data, null, 2));
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy Generate Error:", error.message);
      res.status(500).json({ message: "Gagal menghubungi API Freepik (Proxy Error)", details: error.message });
    }
  });

  app.get("/api/freepik/status/:id", async (req, res) => {
    const { id } = req.params;
    const { endpoint, apiKey, useQuery } = req.query;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      console.error("Proxy Error: Invalid or missing API Key in GET request");
      return res.status(401).json({ message: "Unauthorized: API key is missing or invalid." });
    }

    const cleanKey = (apiKey as string).trim();
    const endpointStr = endpoint as string;
    
    if (!endpointStr || !endpointStr.startsWith('http')) {
      console.error("Proxy Error: Invalid or missing endpoint in GET request");
      return res.status(400).json({ message: "Invalid endpoint provided" });
    }

    // Ensure no double slashes when joining
    const baseUrl = endpointStr.endsWith('/') ? endpointStr.slice(0, -1) : endpointStr;
    
    // Support both path parameter and query parameter formats
    let fullUrl = `${baseUrl}/${id}`;
    if (useQuery === 'true') {
      fullUrl = `${baseUrl}?task_id=${id}`;
    }
    
    console.log(`Proxying GET to: ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': cleanKey,
          'x-freepik-api-key': cleanKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const contentType = response.headers.get("content-type");
      console.log(`Proxy Response Status: ${response.status} (${response.statusText})`);
      console.log(`Proxy Content-Type: ${contentType}`);

      const text = await response.text();
      let data;
      if (contentType && contentType.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = { message: text };
        }
      } else {
        data = { message: text };
      }

      if (!response.ok) {
        console.error(`Freepik API Error (${response.status}) GET to ${fullUrl}:`, JSON.stringify(data, null, 2));
      } else {
        console.log(`Freepik API Success GET to ${fullUrl}`);
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy Status Error:", error.message);
      res.status(500).json({ message: "Gagal menghubungi API Freepik (Proxy Error)", details: error.message });
    }
  });

  app.get("/api/freepik/list", async (req, res) => {
    const { endpoint, apiKey } = req.query;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(401).json({ message: "Unauthorized: API key is missing or invalid." });
    }

    const cleanKey = (apiKey as string).trim();
    const endpointStr = endpoint as string;
    
    if (!endpointStr || !endpointStr.startsWith('http')) {
      return res.status(400).json({ message: "Invalid endpoint provided" });
    }

    console.log(`Proxying LIST GET to: ${endpointStr}`);
    
    try {
      const response = await fetch(endpointStr, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': cleanKey,
          'x-freepik-api-key': cleanKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON response in proxy list:", text);
        data = { message: text };
      }
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy List Error:", error.message);
      res.status(500).json({ message: "Gagal menghubungi API Freepik (Proxy Error)", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
  });

  // Handle global process errors to prevent EPIPE and other stream errors from crashing the server
  process.on('uncaughtException', (err: any) => {
    console.error('Uncaught Exception:', err);
    // EPIPE (Broken Pipe) happens when a client closes the connection unexpectedly.
    // It's safe to ignore and shouldn't crash the server.
    if (err.code === 'EPIPE') {
      console.log('Handled EPIPE (broken pipe) error safely.');
      return;
    }
    // For other fatal errors, the server might be in an unstable state, 
    // but in a dev environment we prefer to stay alive.
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Periodic cleanup: Delete files in uploads folder older than 1 hour
  setInterval(() => {
    console.log("Running scheduled cleanup of uploads directory...");
    fs.readdir(uploadsDir, (err, files) => {
      if (err) return console.error("Cleanup error:", err);
      
      const now = Date.now();
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          // Delete if older than 1 hour (3600000 ms)
          if (now - stats.mtimeMs > 3600000) {
            fs.unlink(filePath, (err) => {
              if (!err) console.log(`Deleted old file: ${file}`);
            });
          }
        });
      });
    });
  }, 30 * 60 * 1000); // Run every 30 minutes

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Error Handler:", err);
    res.status(500).json({ 
      message: "Internal Server Error", 
      details: err.message || "An unexpected error occurred" 
    });
  });

  return app;
}

const appPromise = startServer();
export default appPromise;
