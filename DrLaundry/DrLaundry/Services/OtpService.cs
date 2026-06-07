using DrLaundry.Data;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace DrLaundry.Services
{
    public class OtpService : IOtpService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<OtpService> _logger;

        public OtpService(ApplicationDbContext context, ILogger<OtpService> logger)
        {
            _context = context;
            _logger = logger;
        }

        
        // GENERATE OTP
        
        public async Task<string> GenerateOtpAsync(string email)
        {
            // Secure random 6-digit OTP
            var randomBytes = new byte[4];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);
            var code = (BitConverter.ToUInt32(randomBytes, 0) % 1000000).ToString("D6");

            var otp = new EmailOtp
            {
                Email = email,
                Code = code,
                ExpiryTime = DateTime.UtcNow.AddMinutes(10),
                IsUsed = false
            };

            _context.EmailOtps.Add(otp);
            await _context.SaveChangesAsync();

            _logger.LogInformation("OTP generated for {Email} at {Time}", email, DateTime.UtcNow);

            return code;
        }

        // VERIFY OTP (DB only)
        
        public async Task<bool> VerifyOtpAsync(string email, string code)
        {
            _logger.LogInformation("OTP verification attempt for {Email}", email);

            var otp = await _context.EmailOtps
                .Where(x => x.Email == email && x.Code == code && !x.IsUsed)
                .OrderByDescending(x => x.Id)
                .FirstOrDefaultAsync();

            if (otp == null)
            {
                _logger.LogWarning("Invalid OTP attempt for {Email}", email);
                return false;
            }

            if (otp.ExpiryTime < DateTime.UtcNow)
            {
                _logger.LogWarning("Expired OTP attempt for {Email}", email);
                return false;
            }

            otp.IsUsed = true;
            await _context.SaveChangesAsync();

            _logger.LogInformation("OTP verified successfully for {Email}", email);

            return true;
        }
    }
}
