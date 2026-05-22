using DrLaundry.DTOs;

namespace DrLaundry.Services.Interfaces
{
    public interface IAuthService
    {
        Task<ApiResponse<string>> RegisterAsync(RegisterDto model);
        Task<ApiResponse<string>> LoginAsync(LoginDto model);
        Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto model);
        Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordDto model);
        Task<ApiResponse<string>> VerifyEmailAsync(VerifyEmailDto model);
    }
}
