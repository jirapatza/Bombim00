package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.LotteryViewModel
import com.example.ui.MainScreen
import com.example.ui.theme.LotteryAlertTheme
import com.example.ui.theme.Slate950

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            LotteryAlertTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Slate950
                ) {
                    val viewModel: LotteryViewModel = viewModel()
                    MainScreen(viewModel = viewModel)
                }
            }
        }
    }
}
