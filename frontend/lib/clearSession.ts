// Utility to manually delete all cookies
export function deleteAllCookies() {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();

        // Delete cookie for all possible paths and domains
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname;
    }

    // Explicitly try to clear known auth cookies with various paths/domains
    const knownCookies = ['cyb_access', 'cyb_refresh', 'cyb_access_v2', 'cyb_refresh_v2', 'sessionid', 'csrftoken'];
    knownCookies.forEach(name => {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
    });
}

// Utility to clear all storage
export function clearAllStorage() {
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.error("Failed to clear storage:", e);
    }
}

// Complete session clear
export function clearCompleteSession() {
    deleteAllCookies();
    clearAllStorage();
}
