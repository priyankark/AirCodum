const esbuild = require("esbuild");
const fs = require("fs-extra");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

async function copyNativeAddons() {
  // RobotJS copying (unchanged)
  const platforms = [
    "darwin-x64+arm64",
    "linux-x64",
    "win32-ia32",
    "win32-x64",
  ];
  const sourceDir = path.join(
    __dirname,
    "node_modules/@hurdlegroup/robotjs/prebuilds"
  );

  for (const platform of platforms) {
    const targetDir = path.join(__dirname, "dist", platform);
    try {
      await fs.ensureDir(targetDir);
      await fs.copy(
        path.join(sourceDir, platform, "@hurdlegroup+robotjs.node"),
        path.join(targetDir, "@hurdlegroup+robotjs.node")
      );
      console.log(`[native-addon] copied successfully for ${platform}`);
    } catch (err) {
      console.error(`[native-addon] Error copying for ${platform}:`, err);
    }
  }

  // Copy screenshot-desktop batch file for windows from node_modules
  const screenshotDesktopSource = path.join(
    __dirname,
    "node_modules/screenshot-desktop/lib/win32/screenCapture_1.3.2.bat"
  );
  const screenshotDesktopTarget = path.join(
    __dirname,
    "dist/screenCapture_1.3.2.bat"
  );
  try {
    await fs.copy(screenshotDesktopSource, screenshotDesktopTarget);
    console.log(
      `[native-addon] copied screenshot-desktop batch file successfully`
    );
  } catch (err) {
    console.error(
      `[native-addon] Error copying screenshot-desktop batch file:`,
      err
    );
  }
  // Package app.manifest from screenshot-desktop for windows as well
  const manifestSource = path.join(
    __dirname,
    "node_modules/screenshot-desktop/lib/win32/app.manifest"
  );
  const manifestTarget = path.join(__dirname, "dist/app.manifest");
  try {
    await fs.copy(manifestSource, manifestTarget);
    console.log(`[native-addon] copied app.manifest successfully`);
  } catch (err) {
    console.error(`[native-addon] Error copying app.manifest:`, err);
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const nativeAddonPlugin = {
  name: "native-addon-copy",
  setup(build) {
    build.onEnd(async () => {
      await copyNativeAddons();
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: ["vscode", "@hurdlegroup/robotjs"],
    logLevel: "info",
    plugins: [esbuildProblemMatcherPlugin, nativeAddonPlugin],
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
