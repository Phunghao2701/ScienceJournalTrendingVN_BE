/**
 * Kiểm tra một chuỗi có phải là định dạng email hợp lệ hay không.
 * @param {string} email - Chuỗi email cần kiểm tra.
 * @returns {boolean} True nếu định dạng hợp lệ, ngược lại false.
 */
export const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Kiểm tra một chuỗi có phải là định dạng UUID hợp lệ hay không.
 * @param {string} uuid - Chuỗi cần kiểm tra.
 * @returns {boolean} True nếu là UUID hợp lệ, ngược lại false.
 */
export const isValidUUID = (uuid) => {
    if (!uuid || typeof uuid !== 'string') {
        return false;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

/**
 * Kiểm tra định dạng ngày tháng hợp lệ
 */
export const isValidDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

/**
 * Kiểm tra Role hợp lệ
 */
export const isValidRole = (role) => {
    return ['STUDENT', 'LECTURER', 'RESEARCHER', 'ADMINISTRATOR'].includes(role);
};

/**
 * Kiểm tra Status hợp lệ
 */
export const isValidStatus = (status) => {
    return ['INACTIVE', 'ACTIVE', 'BANNED'].includes(status);
};

/**
 * Kiểm tra Auth Provider hợp lệ
 */
export const isValidType = (type) => {
    return ['LOCAL', 'GOOGLE', 'GITHUB'].includes(type);
};