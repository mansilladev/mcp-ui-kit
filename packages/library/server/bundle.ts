import type * as EsbuildType from 'esbuild';

// Cache bundled JS per entry path (only used in production)
const bundleCache = new Map<string, string>();

// In development mode, skip cache to allow hot-reloading of component changes
const isDev = process.env.NODE_ENV !== 'production';

// Esbuild instance - lazily loaded
let esbuild: typeof EsbuildType | null = null;
let usingWasm = false;

async function getEsbuild(): Promise<typeof EsbuildType> {
    if (esbuild) return esbuild;

    // Try native esbuild first
    try {
        console.log('[mcp-ui-kit] Trying native esbuild...');
        const native = await import('esbuild');
        // Test if native works by running a simple transform
        await native.transform('const x = 1', { loader: 'js' });
        console.log('[mcp-ui-kit] Native esbuild works!');
        esbuild = native;
        return esbuild;
    } catch (nativeError) {
        console.log('[mcp-ui-kit] Native esbuild failed:', nativeError instanceof Error ? nativeError.message : String(nativeError));
        
        // Fall back to wasm
        try {
            console.log('[mcp-ui-kit] Falling back to esbuild-wasm...');
            const wasm = await import('esbuild-wasm');
            await wasm.initialize({
                wasmURL: `https://unpkg.com/esbuild-wasm@${wasm.version}/esbuild.wasm`,
            });
            console.log('[mcp-ui-kit] esbuild-wasm initialized!');
            esbuild = wasm as typeof EsbuildType;
            usingWasm = true;
            return esbuild;
        } catch (wasmError) {
            console.log('[mcp-ui-kit] esbuild-wasm also failed:', wasmError instanceof Error ? wasmError.message : String(wasmError));
            throw wasmError;
        }
    }
}

async function runBuild(entryPath: string): Promise<EsbuildType.BuildResult<{ write: false }>> {
    const esbuild = await getEsbuild();
    console.log('[mcp-ui-kit] runBuild using', usingWasm ? 'wasm' : 'native', 'for:', entryPath);
    
    return esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        write: false,
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
    
    if (!isDev && bundleCache.has(entryPath)) {
        console.log('[mcp-ui-kit] Returning cached bundle');
        return bundleCache.get(entryPath)!;
    }

    let result: EsbuildType.BuildResult<{ write: false }>;
    
    try {
        result = await runBuild(entryPath);
        console.log('[mcp-ui-kit] Build succeeded');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log('[mcp-ui-kit] Build failed:', errorMessage);
        
        // Handle service errors for native esbuild in serverless
        const isServiceError = !usingWasm && error instanceof Error && (
            errorMessage.includes('service was stopped') ||
            errorMessage.includes('service is no longer running') ||
            errorMessage.includes('The service')
        );
        
        if (isServiceError) {
            console.log('[mcp-ui-kit] Service error, stopping and retrying...');
            const esbuild = await getEsbuild();
            await esbuild.stop();
            result = await runBuild(entryPath);
        } else {
            throw error;
        }
    }

    const bundledJS = result.outputFiles[0].text;
    console.log('[mcp-ui-kit] Bundle size:', bundledJS.length, 'bytes');

    if (!isDev) {
        bundleCache.set(entryPath, bundledJS);
    }

    return bundledJS;
}