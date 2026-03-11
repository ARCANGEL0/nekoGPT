import fetch from 'node-fetch';
import { fileTypeFromBuffer } from 'file-type';
import { FormData, File } from 'formdata-node';

export default async function upImg(buffer) {
    const { ext = 'bin', mime = 'application/octet-stream' } =
        (await fileTypeFromBuffer(buffer)) || {};

    const filename = `${Math.random().toString(36).slice(2)}.${ext}`;
    const file = new File([buffer], filename, { type: mime });

    const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const canRetry = (err) => {
        const retryCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE'];
        return retryCodes.includes(err?.code) || err?.name === 'AbortError';
    };

    const fetchRetry = async (url, options, retries = 2) => {
        let lastErr;

        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } catch (err) {
                lastErr = err;
                if (attempt === retries || !canRetry(err)) throw err;
                await waitMs(500 * (attempt + 1));
            } finally {
                clearTimeout(timeout);
            }
        }

        throw lastErr;
    };

    const quickUp = async (url, field = 'file', extra = {}, parse = 'text') => {
        const form = new FormData();
        form.set(field, file);
        for (const [k, v] of Object.entries(extra)) form.set(k, v);

        const res = await fetchRetry(url, { method: 'POST', body: form });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        return parse === 'json' ? res.json() : res.text();
    };

    const toAbs = (url, base) => {
        if (!url || typeof url !== 'string') return null;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (!base) return null;
        return new URL(url, base).toString();
    };

    try {


        
        try {
            const form = new FormData();
            form.set('reqtype', 'fileupload');
            form.set('time', '72h');
            form.set('fileToUpload', file);

            const res = await fetchRetry('https://litterbox.catbox.moe/resources/internals/api.php', {
                method: 'POST',
                body: form
            });

            const text = await res.text();
            if (text.startsWith('https://')) return text.trim();
        } catch (err) {
            console.warn('[upImg] Litterbox failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://uguu.se/upload.php',
                'files[]',
                {},
                'json'
            );

            const url =
                json?.files?.[0]?.url ||
                json?.files?.[0] ||
                json?.url;

            const absolute = toAbs(url, 'https://uguu.se');
            if (absolute) return absolute;
        } catch (err) {
            console.warn('[upImg] uguu.se failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://pomf2.lain.la/upload.php',
                'files[]',
                {},
                'json'
            );

            const url =
                json?.files?.[0]?.url ||
                json?.files?.[0] ||
                json?.url;

            const absolute = toAbs(url, 'https://pomf2.lain.la');
            if (absolute) return absolute;
        } catch (err) {
            console.warn('[upImg] pomf2.lain.la failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp('https://file.io', 'file', {}, 'json');
            if (json?.link) return json.link;
        } catch (err) {
            console.warn('[upImg] file.io failed:', err?.code || err?.message);
        }

        
        try {
            const safeName = encodeURIComponent(filename);
            const res = await fetchRetry(`https://transfer.sh/${safeName}`, {
                method: 'PUT',
                body: buffer,
                headers: { 'Content-Type': mime }
            });

            const text = await res.text();
            if (text.startsWith('http')) return text.trim();
        } catch (err) {
            console.warn('[upImg] transfer.sh failed:', err?.code || err?.message);
        }

        
        try {
            const text = await quickUp('https://0x0.st');
            if (text.startsWith('http')) return text.trim();
        } catch (err) {
            console.warn('[upImg] 0x0.st failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://tmpfiles.org/api/v1/upload',
                'file',
                {},
                'json'
            );

            if (json?.status === 'success') {
                const id = json.data.url.split('tmpfiles.org/')[1];
                return `https://tmpfiles.org/dl/${id}`;
            }
        } catch (err) {
            console.warn('[upImg] tmpfiles.org failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://i.supa.codes/api/upload',
                'file',
                {},
                'json'
            );
            if (json?.link) return json.link;
        } catch (err) {
            console.warn('[upImg] i.supa.codes failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://storage.neko.pe/api/upload.php',
                'file',
                {},
                'json'
            );
            if (json?.result?.url_file) return json.result.url_file;
        } catch (err) {
            console.warn('[upImg] storage.neko.pe failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://file.btch.rf.gd/api/upload.php',
                'file',
                {},
                'json'
            );
            if (json?.result?.url) return json.result.url;
        } catch (err) {
            console.warn('[upImg] file.btch.rf.gd failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://cdn.meitang.xyz/api/upload.php',
                'file',
                {},
                'json'
            );
            if (json?.result?.url) return json.result.url;
        } catch (err) {
            console.warn('[upImg] cdn.meitang.xyz failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://telegra.ph/upload',
                'file',
                {},
                'json'
            );

            if (json?.[0]?.src) {
                return 'https://telegra.ph' + json[0].src;
            }
        } catch (err) {
            console.warn('[upImg] telegra.ph failed:', err?.code || err?.message);
        }

        
        try {
            const json = await quickUp(
                'https://api.anonfiles.com/upload',
                'file',
                {},
                'json'
            );
            if (json?.status && json?.data?.file?.url?.full) {
                return json.data.file.url.full;
            }
        } catch (err) {
            console.warn('[upImg] anonfiles failed:', err?.code || err?.message);
        }

        throw new Error('All uploaders failed');
    } catch (err) {
        console.error('[upImg]', err);
        throw err;
    }
}
