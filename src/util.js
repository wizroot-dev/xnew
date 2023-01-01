
//----------------------------------------------------------------------------------------------------
// env 
//----------------------------------------------------------------------------------------------------

export const env = (() => {

    return new class {
        isMobile() {
            return navigator.userAgent.match(/iPhone|iPad|Android.+Mobile/);
        }
        hasTouch() {
            return window.ontouchstart !== undefined && navigator.maxTouchPoints > 0;
        }
    };
})();
