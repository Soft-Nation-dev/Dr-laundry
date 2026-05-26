using DrLaundry.DTOs;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DrLaundry.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // REGISTER
        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto model)
            => Ok(await _authService.RegisterAsync(model));

        // LOGIN
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto model)
            => Ok(await _authService.LoginAsync(model));

        // REFRESH TOKEN
        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh(RefreshTokenDto model)
            => Ok(await _authService.RefreshTokenAsync(model.Email, model.RefreshToken));

        // FORGOT PASSWORD
        [HttpPost("forgot-password")]
        public async Task<IActionResult> Forgot(ForgotPasswordDto model)
            => Ok(await _authService.ForgotPasswordAsync(model));

        // RESET PASSWORD
        [HttpPost("reset-password")]
        public async Task<IActionResult> Reset(ResetPasswordDto model)
            => Ok(await _authService.ResetPasswordAsync(model));

        // VERIFY EMAIL
        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailDto model)
            => Ok(await _authService.VerifyEmailAsync(model));

        // AUTHORIZATION CHECK
        [HttpGet("check")]
        [Authorize] // ✅ Requires valid JWT
        public IActionResult Check()
            => Ok(new { Message = "You are authorized", User = User.Identity?.Name });

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendOtpDto model)
            => Ok(await _authService.ResendVerificationEmailAsync(model.Email));

    }
}
