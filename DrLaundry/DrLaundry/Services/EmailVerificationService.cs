using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Services
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailService _emailService;
        private readonly IOtpService _otpService;

        public EmailVerificationService(
            UserManager<ApplicationUser> userManager,
            IEmailService emailService,
            IOtpService otpService)
        {
            _userManager = userManager;
            _emailService = emailService;
            _otpService = otpService;
        }

        public async Task SendVerificationEmailAsync(ApplicationUser user)
        {
            var code = await _otpService.GenerateOtpAsync(user.Email!);

            await _emailService.SendEmailAsync(
                user.Email!,
                "Email Verification Code",
                $"Your verification code is: <b>{code}</b>. It expires in 10 minutes."
            );
        }

        public async Task<bool> VerifyEmailAsync(string email, string code)
        {
            var valid = await _otpService.VerifyOtpAsync(email, code);

            if (!valid)
                return false;

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
                return false;

            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);

            return true;
        }
    }
}