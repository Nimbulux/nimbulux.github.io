function setupVisibilityTitleChanger() {
    var waitTimer = null;
    var awayTime = null;
    const originalTitle = document.title;  // 保存原始标题

    const banner = document.getElementById('away-banner');
    const message = document.getElementById('away-message');
    if (!banner || !message) return; // 元素不存在就退出

    function formatDuration(seconds) {
        const MINUTE = 60;
        const HOUR   = 3600;
        const DAY    = 86400;
        const WEEK   = 604800;
        const MONTH  = 2592000;
        const YEAR   = 31536000;

        let years   = Math.floor(seconds / YEAR);
        let rem     = seconds % YEAR;
        let months  = Math.floor(rem / MONTH);
        rem %= MONTH;
        let weeks   = Math.floor(rem / WEEK);
        rem %= WEEK;
        let days    = Math.floor(rem / DAY);
        rem %= DAY;
        let hours   = Math.floor(rem / HOUR);
        rem %= HOUR;
        let minutes = Math.floor(rem / MINUTE);
        let secs    = rem % MINUTE;

        if (years > 0) {
            let main = `${years}年`;
            if (months > 0) main += ` (零${months}月)`;
            main += ' !?这么强!?';
            return main;
        }
        if (months > 0) {
            let main = `${months}月`;
            if (weeks > 0) main += ` (零${weeks}星期)`;
            main += ' 强强!?';
            return main;
        }
        if (weeks > 0) {
            let main = `${weeks}星期`;
            if (days > 0) main += ` (零${days}天)`;
            main += ' 强!';
            return main;
        }
        if (days > 0) {
            let main = `${days}天`;
            if (hours > 0) main += ` ${hours}时`;
            main += ' 有点强';
            return main;
        }
        if (hours > 0) {
            let main = `${hours}时`;
            if (minutes > 0) main += ` ${minutes}分`;
            return main;
        }
        if (minutes > 0) {
            let main = `${minutes}分`;
            if (secs > 0) main += ` ${secs}秒`;
            return main;
        }
        return `${secs}秒`;
    }

    function eventListener() {
        if (document.hidden) {
            clearTimeout(waitTimer);
            awayTime = Date.now();
            waitTimer = setTimeout(() => {
                document.title = '离开好久啦 快回来!';
            }, 180_000);
        } else {
            clearTimeout(waitTimer);
            if (awayTime) {
                const diff = Math.floor((Date.now() - awayTime) / 1000); // 秒
                const text = formatDuration(diff);
                message.textContent = `你离开了 ${text}`;
                banner.classList.add('show');
                setTimeout(() => {
                    banner.classList.remove('show');
                    document.title = originalTitle;
                }, 6000);
                document.title = '欢迎回来';
                awayTime = null;
            } else {
                document.title = originalTitle;
            }
        }
    }

    document.addEventListener('visibilitychange', eventListener);
}