using DrLaundry.DTOs;
using DrLaundry.Services.Interfaces;
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

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto model)
            => Ok(await _authService.RegisterAsync(model));

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto model)
            => Ok(await _authService.LoginAsync(model));

        [HttpPost("forgot-password")]
        public async Task<IActionResult> Forgot(ForgotPasswordDto model)
        => Ok(await _authService.ForgotPasswordAsync(model));

        [HttpPost("reset-password")]
        public async Task<IActionResult> Reset(ResetPasswordDto model)
            => Ok(await _authService.ResetPasswordAsync(model));

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailDto model)
    => Ok(await _authService.VerifyEmailAsync(model));
    }
}
