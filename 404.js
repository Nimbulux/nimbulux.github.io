function getDevicePerformanceLevel() {
    const isFunctionSupported = (fn) => typeof fn === 'function';
    const hasCssSupport = (prop, value) => CSS && CSS.supports && CSS.supports(prop, value);

    let modernFeatures = true;

    modernFeatures = modernFeatures && isFunctionSupported(Promise);
    modernFeatures = modernFeatures && isFunctionSupported(fetch);
    modernFeatures = modernFeatures && isFunctionSupported(Array.from);
    modernFeatures = modernFeatures && isFunctionSupported(requestAnimationFrame);
    try {
        new Function('return (async function(){})');
    } catch (e) {
        modernFeatures = false;
    }

    modernFeatures = modernFeatures && hasCssSupport('display', 'grid');
    modernFeatures = modernFeatures && hasCssSupport('display', 'flex');
    modernFeatures = modernFeatures && hasCssSupport('--custom-prop', 'initial');

    if (!modernFeatures) {
        return 'basic';
    }

    let isLowEndHardware = false;
    const deviceMemory = navigator.deviceMemory;
    const cpuCores = navigator.hardwareConcurrency;

    if (deviceMemory !== undefined) {
        if (deviceMemory <= 1) {
        isLowEndHardware = true;
        }
    }
    if (cpuCores !== undefined && cpuCores <= 2) {
        if (deviceMemory === undefined || deviceMemory <= 2) {
        isLowEndHardware = true;
        }
    }
    if (deviceMemory !== undefined && deviceMemory <= 0.5) isLowEndHardware = true;
    if (cpuCores === 1) isLowEndHardware = true;

    if (isLowEndHardware) {
        return 'basic';
    }

    const hasWebGPU = !!navigator.gpu;
    const ua = navigator.userAgent;
    const isChromium = /Chrome|Chromium|Edg|OPR/i.test(ua) && !/Edge\/(1[0-9]|0)/i.test(ua); // 排除旧 Edge

    if (hasWebGPU && isChromium) {
        return 'trial';
    }

    return 'full';
}

async function loadContent(internalURL) {
    try {
        const response = await fetch(internalURL);
        if (!response.ok) throw new Error(`请求失败: ${response.status}`);
        const pageHTML = await response.text();
        document.getElementById('main-page').innerHTML = pageHTML;
    } catch (error) {
        console.error(error);
        document.getElementById('main-page').innerHTML = '<p>内容加载失败</p>';
    }
}

async function loadContent(internalURL) {
    const response = await fetch(internalURL);
    const pageHTML = await response.text();
    document.getElementById('main-page').innerHTML = pageHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    //jumpPage();
    loadContent('./app/basic/index.html')
});