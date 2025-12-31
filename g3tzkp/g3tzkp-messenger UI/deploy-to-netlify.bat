@echo off
echo ========================================
echo  G3ZKP Messenger - Netlify Deployment
echo ========================================
echo.

echo Step 1: Netlify Login
echo ----------------------
echo A browser window will open for authentication.
echo Please authorize Netlify CLI in your browser.
echo.
pause
npx netlify login
echo.

echo Step 2: Deploy to Production
echo -----------------------------
echo Deploying your PWA to Netlify...
echo.
npx netlify deploy --prod --dir=dist --open

echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Your PWA is now live and can be installed on mobile devices!
echo.
pause
