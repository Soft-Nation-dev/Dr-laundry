using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace DrLaundry.Services
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailService _emailService;
        private readonly IOtpService _otpService;
        private readonly ILogger<EmailVerificationService> _logger;

        public EmailVerificationService(
            UserManager<ApplicationUser> userManager,
            IEmailService emailService,
            IOtpService otpService,
            ILogger<EmailVerificationService> logger)
        {
            _userManager = userManager;
            _emailService = emailService;
            _otpService = otpService;
            _logger = logger;
        }

        public async Task SendVerificationEmailAsync(ApplicationUser user)
        {
            _logger.LogInformation("Sending verification email to {Email}", user.Email);

            var code = await _otpService.GenerateOtpAsync(user.Email!);

            await _emailService.SendEmailAsync(
                user.Email!,
                "Email Verification Code",
                $"Your verification code is: <b>{code}</b>. It expires in 10 minutes."
            );

            // ⚠️ Do not log the actual OTP in production
            _logger.LogInformation("Verification email sent successfully to {Email}", user.Email);
        }

        public async Task<bool> VerifyEmailAsync(string email, string code)
        {
            _logger.LogInformation("Email verification attempt for {Email}", email);

            var valid = await _otpService.VerifyOtpAsync(email, code);

            if (!valid)
            {
                _logger.LogWarning("Email verification failed for {Email}", email);
                return false;
            }

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Email verification failed: User {Email} not found", email);
                return false;
            }

            user.EmailConfirmed = true;
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("Email verified successfully for {Email}", email);
            return true;
        }
    }
}
