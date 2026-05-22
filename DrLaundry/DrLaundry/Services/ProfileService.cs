using DrLaundry.DTOs;
using DrLaundry.Models;
using DrLaundry.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace DrLaundry.Services
{
    public class ProfileService : IProfileService
    {
        private readonly UserManager<ApplicationUser> _userManager;

        public ProfileService(UserManager<ApplicationUser> userManager)
        {
            _userManager = userManager;
        }

        public async Task<ApiResponse<ProfileDto>> GetMyProfile(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
                return ApiResponse<ProfileDto>.Fail("User not found");

            var profile = new ProfileDto
            {
                Id = user.Id,
                Email = user.Email!,
                PhoneNumber = user.PhoneNumber ?? ""
            };

            return ApiResponse<ProfileDto>.SuccessResult(profile);
        }

        public async Task<ApiResponse<string>> UpdateProfile(string userId, UpdateProfileDto model)
        {
            var user = await _userManager.FindByIdAsync(userId);

            if (user == null)
                return ApiResponse<string>.Fail("User not found");

            user.PhoneNumber = model.PhoneNumber;

            if (!string.IsNullOrEmpty(model.FullName))
            {
                user.UserName = model.FullName; // or store FullName if you added field
            }

            var result = await _userManager.UpdateAsync(user);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                return ApiResponse<string>.Fail(errors);
            }

            return ApiResponse<string>.SuccessResult("Profile updated successfully");
        }
    }
}