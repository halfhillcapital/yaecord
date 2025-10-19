function getEnvVariable(key: string, defaultValue: string = ''): string {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
}

export const config = {
    // For local development, the default can be localhost.
    // In Docker, we will override this.
    PORT: parseInt(getEnvVariable('PORT', '8020')),
    YAE_URL: getEnvVariable('YAE_URL', 'http://localhost:8010'),
    WHISPER_URL: getEnvVariable('WHISPER_URL', 'http://localhost:8080'),
    KOKORO_URL: getEnvVariable('KOKORO_URL', 'http://localhost:8880'),
};