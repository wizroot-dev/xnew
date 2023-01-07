
//----------------------------------------------------------------------------------------------------
// device 
//----------------------------------------------------------------------------------------------------

export const device = (() => {
    return {
        isMobile: () => {
            return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
        },
        hasTouch: () => {
            return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
        },
    };
})();
