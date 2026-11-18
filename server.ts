import 'dotenv/config';
import express from 'express';
import archiver from 'archiver';
import path from 'path';
import { registerMasterPinRoutes } from './src/server/masterPinLoginApi.ts';
import { bootstrapAttendanceReports, registerReportRoutes } from './src/server/reportRoutes.ts';
import { registerClockRoutes } from './src/server/clockRoutes.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  registerMasterPinRoutes(app);
  registerReportRoutes(app);
  registerClockRoutes(app);
  bootstrapAttendanceReports();

  // Endpoint to download the android app folder as a zip file
  app.get('/api/download', (req, res) => {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=ChronosABC_Android.zip');
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.on('error', (err) => {
      console.error(err);
      res.status(500).send({error: err.message});
    });

    archive.pipe(res);
    archive.directory(path.resolve(process.cwd(), 'android-app'), false);
    archive.finalize();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Since Express v5 is not listed, assuming wildcard * works for fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
