#include <iostream>
#include <vector>
using namespace std;

int main()
{
    int t;
    cin >> t;
    while (t--)
    {
        int n;
        cin >> n;
        vector<int> vec(n);

        for (int i = 0; i < n; i++)
        {
            cin >> vec[i];
        }

        // Selection sort
        for (int i = 0; i < n - 1; i++)
        {
            int minIndex = i;
            for (int j = i + 1; j < n; j++)
            { 
                if (vec[j] < vec[minIndex])
                {
                    minIndex = j;
                }
            }
            int temp = vec[i];
            vec[i] = vec[minIndex];
            vec[minIndex] = temp;
        }

       
        for (int i = 0; i < n; i++)
        { 
            cout << vec[i];
            if (i < n - 1)
                cout << " ";
        }
        cout << endl;
    }
    return 0;
}