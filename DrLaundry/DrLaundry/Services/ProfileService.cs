using DrLaundry.DTOs;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace DrLaundry.Services
{
    public class ProfileService : IProfileService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<ProfileService> _logger;

        public ProfileService(UserManager<ApplicationUser> userManager, ILogger<ProfileService> logger)
        {
            _userManager = userManager;
            _logger = logger;
        }

        // GET PROFILE
        
        public async Task<ApiResponse<ProfileDto>> GetMyProfile(string userId)
        {
            _logger.LogInformation("Profile fetch attempt for UserId {UserId}", userId);

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                _logger.LogWarning("Profile fetch failed: UserId {UserId} not found", userId);
                return ApiResponse<ProfileDto>.Fail("User not found");
            }

            var profile = new ProfileDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                Name = user.Name,
                Address = user.Address,
            };

            _logger.LogInformation("Profile fetched successfully for UserId {UserId}", userId);
            return ApiResponse<ProfileDto>.SuccessResult(profile);
        }

        // UPDATE PROFILE
        
        public async Task<ApiResponse<string>> UpdateProfile(string userId, UpdateProfileDto model)
        {
            _logger.LogInformation("Profile update attempt for UserId {UserId}", userId);

            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
            {
                _logger.LogWarning("Profile update failed: UserId {UserId} not found", userId);
                return ApiResponse<string>.Fail("User not found");
            }

            // Only update allowed fields
            if (!string.IsNullOrEmpty(model.PhoneNumber))
                user.PhoneNumber = model.PhoneNumber;

            if (!string.IsNullOrEmpty(model.Name))
                user.Name = model.Name; // safer than overwriting UserName

            if (!string.IsNullOrEmpty(model.Address))
                user.Address = model.Address;

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                _logger.LogError("Profile update failed for UserId {UserId}: {Errors}", userId, errors);
                return ApiResponse<string>.Fail(errors);
            }

            _logger.LogInformation("Profile updated successfully for UserId {UserId}", userId);
            return ApiResponse<string>.SuccessResult("Profile updated successfully");
        }
    }
}
