using DrLaundry.Models;

namespace DrLaundry.Services.Interfaces
{
    public interface IEmailVerificationService
    {
        Task SendVerificationEmailAsync(ApplicationUser user);
        Task<bool> VerifyEmailAsync(string email, string code);
    }
}