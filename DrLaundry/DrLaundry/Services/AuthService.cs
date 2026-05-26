using DrLaundry.DTOs;
using DrLaundry.Helpers;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace DrLaundry.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly JwtHelper _jwtHelper;
        private readonly IEmailVerificationService _emailVerificationService;
        private readonly IEmailService _emailService;
        private readonly IOtpService _otpService;
        private readonly ILogger<AuthService> _logger;

        // Track failed attempts (replace with Redis/db in production)
        private static readonly Dictionary<string, int> _failedAttempts = new();

        public AuthService(
            UserManager<ApplicationUser> userManager,
            JwtHelper jwtHelper,
            IEmailVerificationService emailVerificationService,
            IEmailService emailService,
            IOtpService otpService,
            ILogger<AuthService> logger)
        {
            _userManager = userManager;
            _jwtHelper = jwtHelper;
            _emailVerificationService = emailVerificationService;
            _emailService = emailService;
            _otpService = otpService;
            _logger = logger;
        }


        // REGISTER
        public async Task<ApiResponse<string>> RegisterAsync(RegisterDto model)
        {
            _logger.LogInformation("Registration attempt for {Email}", model.Email);

            var userExists = await _userManager.FindByEmailAsync(model.Email);
            if (userExists != null)
            {
                _logger.LogWarning("Registration failed: User {Email} already exists", model.Email);
                return ApiResponse<string>.Fail("User already exists");
            }

            var user = new ApplicationUser
            {
                Email = model.Email,
                UserName = model.Email,
                PhoneNumber = model.PhoneNumber,
                Name = model.Name,
                Address = model.Address,
                EmailConfirmed = false
            };

            var result = await _userManager.CreateAsync(user, model.Password);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Registration failed for {Email}: {Errors}", model.Email, errors);
                return ApiResponse<string>.Fail(errors);
            }

            await _userManager.AddToRoleAsync(user, "User");
            await _emailVerificationService.SendVerificationEmailAsync(user);

            _logger.LogInformation("Registration successful for {Email}. Verification email sent.", model.Email);
            return ApiResponse<string>.SuccessResult("OTP sent to email");
        }

        
        // LOGIN WITH RATE LIMIT + REFRESH TOKEN
        public async Task<ApiResponse<LoginResponseDto>> LoginAsync(LoginDto model)
        {
            _logger.LogInformation("Login attempt for {Email}", model.Email);

            if (_failedAttempts.TryGetValue(model.Email, out var attempts) && attempts >= 5)
            {
                _logger.LogWarning("Login blocked: Too many failed attempts for {Email}", model.Email);
                return ApiResponse<LoginResponseDto>.Fail("Too many failed attempts. Try again later.");
            }

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user == null)
            {
                IncrementFailed(model.Email);
                return ApiResponse<LoginResponseDto>.Fail("Invalid credentials");
            }

            var passwordValid = await _userManager.CheckPasswordAsync(user, model.Password);
            if (!passwordValid)
            {
                IncrementFailed(model.Email);
                return ApiResponse<LoginResponseDto>.Fail("Invalid credentials");
            }

            if (!user.EmailConfirmed)
            {
                _logger.LogWarning("Login blocked: Email not verified for {Email}", model.Email);
                return ApiResponse<LoginResponseDto>.Fail("Please verify your email first");
            }

            _failedAttempts[model.Email] = 0; // reset on success

            var accessToken = await _jwtHelper.GenerateTokenAsync(user);
            var refreshToken = _jwtHelper.GenerateRefreshToken();

            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("Login successful for {Email}", model.Email);

            return ApiResponse<LoginResponseDto>.SuccessResult(new LoginResponseDto
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            }, "Login successful");
        }

        // REFRESH TOKEN ENDPOINT

        public async Task<ApiResponse<string>> RefreshTokenAsync(string email, string refreshToken)
        {
            var user = await _userManager.FindByEmailAsync(email);
            if (user == null || user.RefreshToken != refreshToken || user.RefreshTokenExpiryTime <= DateTime.UtcNow)
            {
                _logger.LogWarning("Invalid refresh token for {Email}", email);
                return ApiResponse<string>.Fail("Invalid or expired refresh token");
            }

            var newAccessToken = await _jwtHelper.GenerateTokenAsync(user);
            var newRefreshToken = _jwtHelper.GenerateRefreshToken();

            user.RefreshToken = newRefreshToken;
            user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
            await _userManager.UpdateAsync(user);

            _logger.LogInformation("Refresh token renewed for {Email}", email);

            return ApiResponse<string>.SuccessResult(newAccessToken, "Token refreshed");
        }

        // FORGOT PASSWORD

        public async Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordDto model)
        {
            _logger.LogInformation("Password reset request for {Email}", model.Email);

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user == null)
            {
                _logger.LogWarning("Password reset failed: User {Email} not found", model.Email);
                return ApiResponse<string>.Fail("User not found");
            }

            var code = await _otpService.GenerateOtpAsync(model.Email);

            await _emailService.SendEmailAsync(
                model.Email,
                "Password Reset Code",
                $"Your reset code is: <b>{code}</b>"
            );

            _logger.LogInformation("Password reset code sent to {Email}", model.Email);
            return ApiResponse<string>.SuccessResult("Reset code sent");
        }

        // RESET PASSWORD WITH RATE LIMIT
        
        public async Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordDto model)
        {
            _logger.LogInformation("Password reset attempt for {Email}", model.Email);

            if (_failedAttempts.TryGetValue(model.Email, out var attempts) && attempts >= 5)
            {
                _logger.LogWarning("Password reset blocked: Too many failed attempts for {Email}", model.Email);
                return ApiResponse<string>.Fail("Too many failed attempts. Try again later.");
            }

            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user == null)
            {
                IncrementFailed(model.Email);
                return ApiResponse<string>.Fail("User not found");
            }

            var valid = await _otpService.VerifyOtpAsync(model.Email, model.Token);
            if (!valid)
            {
                IncrementFailed(model.Email);
                return ApiResponse<string>.Fail("Invalid or expired code");
            }

            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var result = await _userManager.ResetPasswordAsync(user, resetToken, model.NewPassword);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Password reset failed for {Email}: {Errors}", model.Email, errors);
                IncrementFailed(model.Email);
                return ApiResponse<string>.Fail(errors);
            }

            _failedAttempts[model.Email] = 0; // reset on success

            _logger.LogInformation("Password reset successful for {Email}", model.Email);
            return ApiResponse<string>.SuccessResult("Password reset successful");
        }

        // VERIFY EMAIL WITH RATE LIMIT

        public async Task<ApiResponse<string>> VerifyEmailAsync(VerifyEmailDto model)
        {
            _logger.LogInformation("Email verification attempt for {Email}", model.Email);

            if (_failedAttempts.TryGetValue(model.Email, out var attempts) && attempts >= 5)
            {
                _logger.LogWarning("Email verification blocked: Too many failed attempts for {Email}", model.Email);
                return ApiResponse<string>.Fail("Too many failed attempts. Try again later.");
            }

            var result = await _emailVerificationService.VerifyEmailAsync(model.Email, model.Code);

            if (!result)
            {
                IncrementFailed(model.Email);
                return ApiResponse<string>.Fail("Invalid or expired code");
            }

            _failedAttempts[model.Email] = 0; // reset on success

            _logger.LogInformation("Email verified successfully for {Email}", model.Email);
            return ApiResponse<string>.SuccessResult("Email verified successfully");
        }

        private void IncrementFailed(string email)
        {
            if (_failedAttempts.ContainsKey(email))
                _failedAttempts[email]++;
            else
                _failedAttempts[email] = 1;

            _logger.LogWarning("Failed attempt {Count} for {Email}", _failedAttempts[email], email);
        }

        public async Task<ApiResponse<string>> ResendVerificationEmailAsync(string email)
        {
            _logger.LogInformation("Resend verification email attempt for {Email}", email);

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
            {
                _logger.LogWarning("Resend failed: User {Email} not found", email);
                return ApiResponse<string>.Fail("User not found");
            }

            if (user.EmailConfirmed)
            {
                _logger.LogWarning("Resend failed: Email {Email} already verified", email);
                return ApiResponse<string>.Fail("Email already verified");
            }

            await _emailVerificationService.SendVerificationEmailAsync(user);

            _logger.LogInformation("Verification email resent successfully to {Email}", email);
            return ApiResponse<string>.SuccessResult("Verification email resent");
        }

    }
}
