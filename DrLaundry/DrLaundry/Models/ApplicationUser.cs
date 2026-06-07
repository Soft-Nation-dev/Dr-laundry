using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? EmailVerificationToken { get; set; }
        //public bool EmailConfirmed { get; set; }
        public string? Name { get; set; }
        public string? Address { get; set; }
        //public int? Age { get; set; }

        // Refresh token support
        public string? RefreshToken { get; set; }
        public DateTime? RefreshTokenExpiryTime { get; set; }
    }
}
