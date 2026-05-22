using DrLaundry.DTOs;

namespace DrLaundry.Services.Interfaces
{
    public interface IProfileService
    {
        Task<ApiResponse<ProfileDto>> GetMyProfile(string userId);
        Task<ApiResponse<string>> UpdateProfile(string userId, UpdateProfileDto model);
    }
}
