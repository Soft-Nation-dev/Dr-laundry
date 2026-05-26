using DrLaundry.DTOs;

namespace DrLaundry.Services.Interfaces
{
    public interface IAuthService
    {
        // Registration
        Task<ApiResponse<string>> RegisterAsync(RegisterDto model);

        // Login now returns both Access + Refresh tokens
        Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginDto model);

        // Refresh token exchange
        Task<ApiResponse<string>> RefreshTokenAsync(string email, string refreshToken);

        // Forgot password
        Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto model);

        // Reset password
        Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordDto model);

        // Verify email
        Task<ApiResponse<string>> VerifyEmailAsync(VerifyEmailDto model);

        Task<ApiResponse<string>> ResendVerificationEmailAsync(string email);
    }
}
