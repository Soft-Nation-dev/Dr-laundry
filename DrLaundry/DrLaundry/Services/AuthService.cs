using DrLaundry.DTOs;
using DrLaundry.Helpers;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly JwtHelper _jwtHelper;
        private readonly IEmailVerificationService _emailVerificationService;
        private readonly IEmailService _emailService;
        private readonly IOtpService _otpService;

        public AuthService(
            UserManager<ApplicationUser> userManager,
            JwtHelper jwtHelper,
            IEmailVerificationService emailVerificationService,
            IEmailService emailService,
            IOtpService otpService)
        {
            _userManager = userManager;
            _jwtHelper = jwtHelper;
            _emailVerificationService = emailVerificationService;
            _emailService = emailService;
            _otpService = otpService;
        }

        // =========================
        // REGISTER
        // =========================
        public async Task<ApiResponse<string>> RegisterAsync(RegisterDto model)
        {
            var userExists = await _userManager.FindByEmailAsync(model.Email);
            if (userExists != null)
                return ApiResponse<string>.Fail("User already exists");

            var user = new ApplicationUser
            {
                Email = model.Email,
                UserName = model.Email,
                PhoneNumber = model.PhoneNumber,
                EmailConfirmed = false
            };

            var result = await _userManager.CreateAsync(user, model.Password);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                return ApiResponse<string>.Fail(errors);
            }

            await _userManager.AddToRoleAsync(user, "User");

            await _emailVerificationService.SendVerificationEmailAsync(user);

            return ApiResponse<string>.SuccessResult("OTP sent to email");
        }

        // =========================
        // LOGIN
        // =========================
        public async Task<ApiResponse<string>> LoginAsync(LoginDto model)
        {
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user == null)
                return ApiResponse<string>.Fail("Invalid credentials");

            var passwordValid = await _userManager.CheckPasswordAsync(user, model.Password);

            if (!passwordValid)
                return ApiResponse<string>.Fail("Invalid credentials");

            // 🔥 BLOCK LOGIN IF EMAIL NOT VERIFIED
            if (!user.EmailConfirmed)
                return ApiResponse<string>.Fail("Please verify your email first");

            // 👑 GENERATE TOKEN WITH ROLES (UPDATED JWT)
            var token = await _jwtHelper.GenerateTokenAsync(user);

            return ApiResponse<string>.SuccessResult(token, "Login successful");
        }

        // =========================
        // FORGOT PASSWORD
        // =========================
        public async Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto model)
        {
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user == null)
                return ApiResponse<string>.Fail("User not found");

            var code = await _otpService.GenerateOtpAsync(model.Email);

            await _emailService.SendEmailAsync(
                model.Email,
                "Password Reset Code",
                $"Your reset code is: <b>{code}</b>"
            );

            return ApiResponse<string>.SuccessResult("Reset code sent");
        }

        // =========================
        // RESET PASSWORD
        // =========================
        public async Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordDto model)
        {
            var user = await _userManager.FindByEmailAsync(model.Email);

            if (user == null)
                return ApiResponse<string>.Fail("User not found");

            var valid = await _otpService.VerifyOtpAsync(model.Email, model.Token);

            if (!valid)
                return ApiResponse<string>.Fail("Invalid or expired code");

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);

            var result = await _userManager.ResetPasswordAsync(
                user,
                resetToken,
                model.NewPassword
            );

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                return ApiResponse<string>.Fail(errors);
            }

            return ApiResponse<string>.SuccessResult("Password reset successful");
        }

        public async Task<ApiResponse<string>> VerifyEmailAsync(VerifyEmailDto model)
        {
            var result = await _emailVerificationService.VerifyEmailAsync(
                model.Email,
                model.Code
            );

            if (!result)
                return ApiResponse<string>.Fail("Invalid or expired code");

            return ApiResponse<string>.SuccessResult("Email verified successfully");
        }
    }
}