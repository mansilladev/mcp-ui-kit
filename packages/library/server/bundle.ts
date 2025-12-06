import * as esbuild from 'esbuild';

// Cache bundled JS per entry path (only used in production)
const bundleCache = new Map<string, string>();

// In development mode, skip cache to allow hot-reloading of component changes
const isDev = process.env.NODE_ENV !== 'production';

async function runBuild(entryPath: string): Promise<esbuild.BuildResult<{ write: false }>> {
    console.log('[mcp-ui-kit] runBuild called for:', entryPath);
    return esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        write: false,  // No disk I/O - keep everything in memory
        format: 'iife',
        target: 'es2020',
        jsx: 'automatic',
        loader: {
            '.tsx': 'tsx',
            '.ts': 'ts',
        },
        minify: !isDev,
    });
}

export async function bundleComponent(entryPath: string): Promise<string> {
    console.log('[mcp-ui-kit] bundleComponent called for:', entryPath);
    console.log('[mcp-ui-kit] isDev:', isDev, 'NODE_ENV:', process.env.NODE_ENV);
    console.log('[mcp-ui-kit] Cache has entry:', bundleCache.has(entryPath));
    
    if (!isDev && bundleCache.has(entryPath)) {
        console.log('[mcp-ui-kit] Returning cached bundle');
        return bundleCache.get(entryPath)!;
    }

    let result: esbuild.BuildResult<{ write: false }>;
    
    try {
        console.log('[mcp-ui-kit] Attempting first build...');
        result = await runBuild(entryPath);
        console.log('[mcp-ui-kit] First build succeeded');
    } catch (error) {
        console.log('[mcp-ui-kit] First build failed:', error instanceof Error ? error.message : error);
        
        // Handle esbuild service errors in serverless environments (Vercel, Lambda, etc.)
        // This happens when the serverless runtime freezes/stops the esbuild subprocess.
        const isServiceError = error instanceof Error && (
            error.message.includes('service was stopped') ||
            error.message.includes('service is no longer running') ||
            error.message.includes('The service')
        );
        console.log('[mcp-ui-kit] Is service error:', isServiceError);
        
        if (isServiceError) {
            // Force stop the dead service, then retry - esbuild will start fresh
            console.log('[mcp-ui-kit] Stopping esbuild service and retrying...');
            await esbuild.stop();
            result = await runBuild(entryPath);
            console.log('[mcp-ui-kit] Retry succeeded');
        } else {
            throw error;
        }
    }

    const bundledJS = result.outputFiles[0].text;
    console.log('[mcp-ui-kit] Bundle size:', bundledJS.length, 'bytes');

    // Only cache in production mode
    if (!isDev) {
        bundleCache.set(entryPath, bundledJS);
        console.log('[mcp-ui-kit] Bundle cached');
    }

    return bundledJS;
}