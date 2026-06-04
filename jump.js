/**
 * 获取设备性能级别
 * @returns {'basic' | 'full' | 'trial'} 性能级别
 */
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

const level = getDevicePerformanceLevel();
console.log(`[性能级别] ${level}`);

// test
if (level === 'basic') {
    alert('您的设备性能较低，将启用基础模式以保证流畅体验。');
} else if (level === 'full') {
    alert('您的设备性能良好，支持完整功能。');
} else if (level === 'trial') {
    alert('您的浏览器支持 WebGPU 等前沿特性，可体验最新实验功能！');
}