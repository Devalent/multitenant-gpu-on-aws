const isDebug = process.env.NODE_ENV !== 'production';

const config = {
  "is_debug": isDebug,
  "port": process.env.PORT || 3000,
  "chrome": {
    "timeout": 60,
    "flags": [
      "--kiosk",
      "--start-fullscreen",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--disable-infobars",
      "--no-default-browser-check",
      "--use-gl=desktop",
      "--ignore-gpu-blacklist",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization",
      "--enable-oop-rasterization",
      "--enable-tcp-fast-open",
      "--enable-accelerated-video-decode",
      "--enable-webgl",
    ],
    "disabled_flags": [
      "--headless",
      "--enable-automation",
      "--disable-gpu",
      "--disable-renderer-backgrounding",
    ],
  },
  "chrome_debug": {
    "timeout": 60,
    "flags": [
      "--headless",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--disable-infobars",
      "--no-default-browser-check",
      "--enable-tcp-fast-open",
      "--disable-gpu",
    ],
    "disabled_flags": [
      "--enable-automation",
    ],
  },
  "recorder": {
    "concurrency": isDebug ? 1 : 2,
    "max_width": 1920,
    "max_height": 1080,
  },
};

export default config;