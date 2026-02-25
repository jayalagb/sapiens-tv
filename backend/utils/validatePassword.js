function validatePassword(password) {
    if (!password || password.length < 8) {
        return 'La contrasena debe tener al menos 8 caracteres';
    }
    if (password.length > 128) {
        return 'La contrasena no puede exceder 128 caracteres';
    }
    if (!/[a-z]/.test(password)) {
        return 'La contrasena debe incluir al menos una letra minuscula';
    }
    if (!/[A-Z]/.test(password)) {
        return 'La contrasena debe incluir al menos una letra mayuscula';
    }
    if (!/[0-9]/.test(password)) {
        return 'La contrasena debe incluir al menos un numero';
    }
    return null;
}

module.exports = validatePassword;
